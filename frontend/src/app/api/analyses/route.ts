import { NextResponse } from "next/server";
import { classifyListingUrl } from "@/lib/analysis/listing/classify";
import { HemnetUrlError } from "@/lib/analysis/listing/hemnet";
import type { ManualListingFields } from "@/lib/analysis/listing/manual";
import {
  requestAnalysis,
  type AnalysisRequestInput,
  type AnalysisRequestResult,
} from "@/lib/analysis/pipeline";
import { consumeAnalysisQuota, recordAnalysisRequest, type AnalysisType } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";
import { isDevAdmin } from "@/lib/auth/devAdmin";

export const maxDuration = 120;

/**
 * POST /api/analyses — run (or return a cached) analysis for a property.
 *
 * Body: { url?: string; manual?: ManualListingFields; analysisType: "free" |
 * "premium"; force?: boolean }
 * - url:          a listing URL (Hemnet is URL-parseable today; other
 *                 providers get an honest "not supported yet" error).
 * - manual:       manually entered property details (address required).
 * - analysisType: which quota bucket this request draws from. Both types
 *                 run the identical pipeline/report — this only decides
 *                 which counter on the caller's profile is decremented.
 * - force:        create a new analysis version even if a fresh one exists.
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

  let body: { url?: unknown; manual?: unknown; force?: unknown; analysisType?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Request body must be JSON.");
  }

  if (body.analysisType !== "free" && body.analysisType !== "premium") {
    return errorResponse(
      400,
      "invalid_request",
      "analysisType must be \"free\" or \"premium\"."
    );
  }
  const analysisType: AnalysisType = body.analysisType;

  let input: AnalysisRequestInput;

  if (typeof body.url === "string" && body.url.trim() !== "") {
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
    input = { kind: "manual", fields: body.manual };
  } else {
    return errorResponse(
      400,
      "invalid_request",
      "Provide a listing URL or manually entered details including an address."
    );
  }

  try {
    // The local dev-admin account (see lib/auth/devAdmin.ts) already
    // advertises "unlimited access, nothing required for testing" in the
    // dashboard UI — bypass quota consumption for it rather than silently
    // contradicting that promise once quotas exist.
    const devAdmin = isDevAdmin(user.email);
    let quotaConsumed = false;
    let unlocked = true;
    if (!devAdmin) {
      const remaining = await consumeAnalysisQuota(user.id, analysisType);
      if (remaining === null) {
        // Premium: run anyway and create a locked (paywalled) request.
        // Free: reject as before.
        if (analysisType === "free") {
          return errorResponse(
            402,
            "quota_exhausted",
            "You have no free analyses left this period."
          );
        }
        unlocked = false;
      } else {
        quotaConsumed = true;
      }
    }

    const result = await requestAnalysis(input, { force: body.force === true });
    await recordAnalysisRequest({
      userId: user.id,
      analysisId: result.analysis.id,
      propertyId: result.property.id,
      analysisType,
      quotaConsumed,
      unlocked,
    });
    return resultResponse(result);
  } catch (err) {
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
