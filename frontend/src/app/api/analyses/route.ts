import { NextResponse } from "next/server";
import { classifyListingUrl } from "@/lib/analysis/listing/classify";
import { HemnetUrlError } from "@/lib/analysis/listing/hemnet";
import { extractFromManualFields, type ManualListingFields } from "@/lib/analysis/listing/manual";
import {
  requestAnalysis,
  missingEssentialFields,
  ESSENTIAL_FIELD_LABELS,
  type AnalysisRequestInput,
  type AnalysisRequestResult,
} from "@/lib/analysis/pipeline";
import { consumeCredit, recordAnalysisRequest, refundCredit, type AnalysisType } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";
import { isDevAdmin } from "@/lib/auth/devAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { OMRADESANALYS_PRICE_SEK } from "@/lib/pricing";

export const maxDuration = 300;

// The per-user credit balance already caps how many analyses an account can
// start, but a single script cycling through disposable accounts from one IP
// could still trigger many full external-API pipeline runs — each one real
// cost (Booli, BRF PDF extraction, external geodata APIs). This is
// defense-in-depth alongside credits, generous enough not to bother a real
// person testing a few listings.
const RATE_LIMIT_PER_HOUR = 20;

const MAX_ADDRESS_LENGTH = 200;

/**
 * POST /api/analyses — run (or return a cached) analysis for a property.
 *
 * Body: { analysisType: "full" | "area"; url?: string; manual?: ManualListingFields;
 *         address?: string; force?: boolean }
 * - analysisType "full": the Trygghetspaket — the complete report. Takes one
 *                 full credit. Needs `url` (a listing URL; Hemnet is
 *                 URL-parseable today, other providers get an honest "not
 *                 supported yet" error) or `manual` (property details,
 *                 address required).
 * - analysisType "area": the standalone Områdesanalys — the area chapter only.
 *                 Takes one area credit. Needs `address` ("street, city").
 * - force:        create a new analysis version even if a fresh one exists.
 *
 * Without a credit of the requested kind nothing runs and nothing is
 * created: 402 no_credit. A credit is taken before the analysis starts and
 * given back if starting it fails or the analysis later can't be completed
 * (pipeline.ts's refund path).
 */

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function resultResponse(result: AnalysisRequestResult) {
  return NextResponse.json({
    analysisId: result.analysis.id,
    propertyId: result.property.id,
    version: result.analysis.version,
    status: result.analysis.status,
    cached: result.cached,
    stale: result.stale,
    ageDays: result.ageDays,
  });
}

const NO_CREDIT_MESSAGE: Record<AnalysisType, string> = {
  full: "Du har inget Trygghetspaket kvar. Köp ett för att analysera en bostad.",
  area: `Du har ingen Områdesanalys kvar. Köp en för ${OMRADESANALYS_PRICE_SEK} kr för att analysera ett område.`,
};

export async function POST(request: Request) {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  if (!checkRateLimit(`analyses:${clientIp(request)}`, RATE_LIMIT_PER_HOUR, 60 * 60_000)) {
    return errorResponse(429, "rate_limited", "För många analysförfrågningar från din uppkoppling – försök igen om en stund.");
  }

  let body: { url?: unknown; manual?: unknown; address?: unknown; force?: unknown; analysisType?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Request body must be JSON.");
  }

  if (body.analysisType !== "full" && body.analysisType !== "area") {
    return errorResponse(400, "invalid_request", "analysisType must be \"full\" or \"area\".");
  }
  const analysisType: AnalysisType = body.analysisType;

  let input: AnalysisRequestInput;

  if (analysisType === "area") {
    const address = typeof body.address === "string" ? body.address.trim() : "";
    if (address === "" || address.length > MAX_ADDRESS_LENGTH) {
      return errorResponse(400, "invalid_request", "Ange adressen du vill analysera området runt.");
    }
    // The city has to be part of the address: an area analysis is a report
    // about *where* a place is, and "Storgatan 12" alone matches a street in
    // dozens of municipalities — the customer would pay for the wrong area.
    const { municipality } = extractFromManualFields({ address });
    if (!municipality) {
      return errorResponse(
        422,
        "address_needs_city",
        "Ange både gatuadress och ort, till exempel Storgatan 12, Stockholm."
      );
    }
    input = { kind: "manual", fields: { address } };
  } else if (typeof body.url === "string" && body.url.trim() !== "") {
    const classification = classifyListingUrl(body.url);
    switch (classification.kind) {
      case "hemnet":
        input = { kind: "hemnet", url: classification.url };
        break;
      case "booli":
        return errorResponse(
          422,
          "booli_needs_address",
          "We recognized that Booli link, but the listing page itself can't be read automatically — enter the property's address manually and we'll pull matching price, fee and area data from Booli for you."
        );
      case "unsupported_provider":
        return errorResponse(
          422,
          "unsupported_provider",
          `We don't support ${classification.provider} links yet — enter the details manually and we'll analyze the property.`
        );
      case "unknown_url":
        return errorResponse(
          422,
          "not_a_listing",
          "That doesn't look like a property listing we can read. If you have an address, enter the details manually."
        );
      case "invalid_url":
        return errorResponse(
          400,
          "invalid_url",
          "We couldn't read that link. Double check it's a full listing URL, or enter the address manually."
        );
    }
  } else if (isManualFields(body.manual)) {
    const extracted = extractFromManualFields(body.manual);
    const missing = missingEssentialFields(extracted.attributes, extracted);
    if (missing.length > 0) {
      const labels = missing.map((f) => ESSENTIAL_FIELD_LABELS[f] ?? f).join(", ");
      return errorResponse(
        422,
        "insufficient_manual_data",
        `Fyll i följande för att kunna analysera bostaden: ${labels}.`
      );
    }
    input = { kind: "manual", fields: body.manual };
  } else {
    return errorResponse(
      400,
      "invalid_request",
      "Provide a listing URL or manually entered details including an address."
    );
  }

  // Set once a credit has actually been taken, so the catch below can tell
  // "failed before charging" from "failed after charging" and only refunds
  // the latter.
  let creditTaken = false;
  try {
    // The local dev-admin account (see lib/auth/devAdmin.ts) already
    // advertises "unlimited access, nothing required for testing" in the
    // dashboard UI — bypass credits for it rather than silently
    // contradicting that promise. Never active outside `next dev`.
    //
    // The credit is checked before anything is created, so an account
    // without one can't fill the properties table with addresses.
    if (!isDevAdmin(user.email)) {
      const remaining = await consumeCredit(user.id, analysisType);
      if (remaining === null) {
        return errorResponse(402, "no_credit", NO_CREDIT_MESSAGE[analysisType]);
      }
      creditTaken = true;
    }

    const result = await requestAnalysis(input, { force: body.force === true, scope: analysisType });
    await recordAnalysisRequest({
      userId: user.id,
      analysisId: result.analysis.id,
      propertyId: result.property.id,
      analysisType,
      quotaConsumed: creditTaken,
    });
    return resultResponse(result);
  } catch (err) {
    if (creditTaken) {
      await refundCredit(user.id, analysisType).catch((refundErr) => {
        console.error(`POST /api/analyses: refund of a ${analysisType} credit failed for user ${user.id}:`, refundErr);
      });
    }
    if (err instanceof HemnetUrlError) {
      return errorResponse(
        422,
        "unreadable_listing",
        "We couldn't read that Hemnet link. Double check it's a listing URL, or enter the address manually."
      );
    }
    console.error("POST /api/analyses failed:", err);
    return errorResponse(
      500,
      "analysis_failed",
      "Something went wrong while analyzing the property. Please try again."
    );
  }
}

function isManualFields(value: unknown): value is ManualListingFields {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { address?: unknown }).address === "string" &&
    (value as { address: string }).address.trim() !== ""
  );
}
