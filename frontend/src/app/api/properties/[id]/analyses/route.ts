import { NextResponse } from "next/server";
import { rerunAnalysisForProperty } from "@/lib/analysis/pipeline";
import { openReviewForAnalysis } from "@/lib/brf/openReview";
import { listAnalysesForProperty } from "@/lib/analysis/store";
import { getBestEntitlementForProperty } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";
import { apiError } from "@/i18n/apiText";

/**
 * GET  /api/properties/:id/analyses — full analysis version history for a
 *      property the caller has requested at least once (analyses are
 *      append-only, so this is also the property's version timeline).
 * POST /api/properties/:id/analyses — "Update analysis": run the pipeline
 *      again and store the result as a new version. What runs follows what
 *      the caller bought: a full owner refreshes the whole analysis, an
 *      area-only owner refreshes the area analysis (never the full pipeline).
 *      Costs no credit — the analysis is already theirs.
 */

function notFound() {
  return NextResponse.json(
    { error: { code: "not_found", message: "No property with that id." } },
    { status: 404 }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    if ((await getBestEntitlementForProperty(user.id, id)) === null) return notFound();

    const analyses = await listAnalysesForProperty(id);
    return NextResponse.json({
      analyses: analyses.map((a) => ({
        id: a.id,
        version: a.version,
        status: a.status,
        engineVersion: a.engineVersion,
        createdAt: a.createdAt,
        completedAt: a.completedAt,
      })),
    });
  } catch (err) {
    console.error(`GET /api/properties/${id}/analyses failed:`, err);
    return await apiError(500, "internal_error", "analyses.loadHistoryFailed");
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const entitlement = await getBestEntitlementForProperty(user.id, id);
    if (entitlement === null) return notFound();

    const result = await rerunAnalysisForProperty(id, entitlement);
    if (!result) return notFound();
    // The new version is a new report: a reviewer releases it like any other (the customer keeps the earlier one meanwhile).
    await openReviewForAnalysis(result.property, result.analysis);
    return NextResponse.json({
      analysisId: result.analysis.id,
      propertyId: result.property.id,
      version: result.analysis.version,
      status: result.analysis.status,
      cached: false,
      stale: false,
      ageDays: 0,
    });
  } catch (err) {
    console.error(`POST /api/properties/${id}/analyses failed:`, err);
    return await apiError(500, "analysis_failed", "analyses.updateFailed");
  }
}
