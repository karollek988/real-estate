import { NextResponse } from "next/server";
import { rerunAnalysisForProperty } from "@/lib/analysis/pipeline";
import { listAnalysesForProperty } from "@/lib/analysis/store";
import { hasAnyAnalysisRequestForProperty } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";

/**
 * GET  /api/properties/:id/analyses — full analysis version history for a
 *      property the caller has requested at least once (analyses are
 *      append-only, so this is also the property's version timeline).
 * POST /api/properties/:id/analyses — "Update analysis": run the pipeline
 *      again and store the result as a new version.
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
    if (!(await hasAnyAnalysisRequestForProperty(user.id, id))) return notFound();

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

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    if (!(await hasAnyAnalysisRequestForProperty(user.id, id))) return notFound();

    const result = await rerunAnalysisForProperty(id);
    if (!result) return notFound();
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
