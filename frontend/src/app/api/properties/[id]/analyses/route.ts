import { NextResponse } from "next/server";
import { rerunAnalysisForProperty } from "@/lib/analysis/pipeline";
import { listAnalysesForProperty } from "@/lib/analysis/store";
import { requireUser } from "@/lib/auth/requireUser";

/**
 * GET  /api/properties/:id/analyses — full analysis version history (analyses
 *      are append-only, so this is also the property's score timeline).
 * POST /api/properties/:id/analyses — "Update analysis": run the pipeline
 *      again and store the result as a new version.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const analyses = await listAnalysesForProperty(id);
    return NextResponse.json({
      analyses: analyses.map((a) => ({
        id: a.id,
        version: a.version,
        status: a.status,
        engineVersion: a.engineVersion,
        decisionScore: a.decisionScore,
        createdAt: a.createdAt,
        completedAt: a.completedAt,
      })),
    });
  } catch (err) {
    console.error(`GET /api/properties/${id}/analyses failed:`, err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not load the analysis history." } },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const result = await rerunAnalysisForProperty(id);
    if (!result) {
      return NextResponse.json(
        { error: { code: "not_found", message: "No property with that id." } },
        { status: 404 }
      );
    }
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
    return NextResponse.json(
      {
        error: {
          code: "analysis_failed",
          message: "Something went wrong while updating the analysis. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
