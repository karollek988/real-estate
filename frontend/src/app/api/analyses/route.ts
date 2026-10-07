import { after, NextResponse } from "next/server";
import type { PropertyRecord } from "@/lib/analysis/types";
import { ensureBrfReview } from "@/lib/brf/reviews";
import { notifyTeamOfBrfReview } from "@/lib/brf/notify";
import { tenureOfProperty } from "@/lib/report/tenure";
import { classifyListingUrl } from "@/lib/analysis/listing/classify";
import { HemnetUrlError } from "@/lib/analysis/listing/hemnet";
import { extractFromManualFields, type ManualListingFields } from "@/lib/analysis/listing/manual";
import {
  requestAnalysis,
  missingEssentialFields,
  type AnalysisRequestInput,
  type AnalysisRequestResult,
} from "@/lib/analysis/pipeline";
import { consumeCredit, recordAnalysisRequest, refundCredit, type AnalysisType } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";
import { isDevAdmin } from "@/lib/auth/devAdmin";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { OMRADESANALYS_PRICE_SEK } from "@/lib/pricing";
import { apiError, apiTexts } from "@/i18n/apiText";
import { statedLocaleOfRequest } from "@/i18n/requestLocale";
import { rememberCustomerLanguage } from "@/lib/auth/rememberLanguage";

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

export async function POST(request: Request) {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  if (!checkRateLimit(`analyses:${clientIp(request)}`, RATE_LIMIT_PER_HOUR, 60 * 60_000)) {
    return await apiError(429, "rate_limited", "analyses.rateLimited");
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
      return await apiError(400, "invalid_request", "analyses.addressRequired");
    }
    // The city has to be part of the address: an area analysis is a report
    // about *where* a place is, and "Storgatan 12" alone matches a street in
    // dozens of municipalities — the customer would pay for the wrong area.
    const { municipality } = extractFromManualFields({ address });
    if (!municipality) {
      return await apiError(422, "address_needs_city", "analyses.addressNeedsCity");
    }
    input = { kind: "manual", fields: { address } };
  } else if (typeof body.url === "string" && body.url.trim() !== "") {
    const classification = classifyListingUrl(body.url);
    switch (classification.kind) {
      case "hemnet":
        input = { kind: "hemnet", url: classification.url };
        break;
      case "booli":
        return await apiError(422, "booli_needs_address", "analyses.booliNeedsAddress");
      case "unsupported_provider":
        return await apiError(422, "unsupported_provider", "analyses.unsupportedProvider", { provider: classification.provider });
      case "unknown_url":
        return await apiError(422, "not_a_listing", "analyses.notAListing");
      case "invalid_url":
        return await apiError(400, "invalid_url", "analyses.invalidUrl");
    }
  } else if (isManualFields(body.manual)) {
    const extracted = extractFromManualFields(body.manual);
    const missing = missingEssentialFields(extracted.attributes, extracted);
    if (missing.length > 0) {
      const { loose } = await apiTexts();
      const labels = missing.map((f) => (loose.has(`essentialFields.${f}`) ? loose(`essentialFields.${f}`) : f)).join(", ");
      return await apiError(422, "insufficient_manual_data", "analyses.insufficientManualData", { labels });
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
        return await apiError(
          402,
          "no_credit",
          analysisType === "full" ? "analyses.noCredit.full" : "analyses.noCredit.area",
          { price: OMRADESANALYS_PRICE_SEK }
        );
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
    if (analysisType === "full") await openBrfReview(result.property);
    // the e-mails about this analysis (the housing association analysis being ready) come in the language it was ordered in
    const orderedIn = statedLocaleOfRequest(request);
    if (orderedIn) await rememberCustomerLanguage(user, orderedIn);
    return resultResponse(result);
  } catch (err) {
    if (creditTaken) {
      await refundCredit(user.id, analysisType).catch((refundErr) => {
        console.error(`POST /api/analyses: refund of a ${analysisType} credit failed for user ${user.id}:`, refundErr);
      });
    }
    if (err instanceof HemnetUrlError) {
      return await apiError(422, "unreadable_listing", "analyses.unreadableListing");
    }
    console.error("POST /api/analyses failed:", err);
    return await apiError(500, "analysis_failed", "analyses.failed");
  }
}

/**
 * A Trygghetspaket for a home with a housing association includes the BRF
 * analysis, which a Köpanalys reviewer publishes within 24 hours
 * (lib/brf/reviews.ts) — the clock starts here, and the team is emailed.
 * Never fails the purchase: the report page opens the review too if this
 * didn't get to.
 */
async function openBrfReview(property: PropertyRecord): Promise<void> {
  if (tenureOfProperty(property) === "freehold") return;
  try {
    const { review, opened } = await ensureBrfReview(property.id, "purchase");
    if (opened) {
      after(() =>
        notifyTeamOfBrfReview(review, "purchase").catch((err) =>
          console.error(`BRF review notification failed for property ${property.id}:`, err)
        )
      );
    }
  } catch (err) {
    console.error(`POST /api/analyses: could not open the BRF review for property ${property.id}:`, err);
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
