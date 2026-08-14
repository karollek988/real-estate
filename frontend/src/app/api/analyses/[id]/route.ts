import { NextResponse } from "next/server";
import { getReportForViewer } from "@/lib/analysis/access";
import { requireUser } from "@/lib/auth/requireUser";

/** GET /api/analyses/:id — one analysis (any version) with its property, redacted to the caller's entitlement. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const found = await getReportForViewer(id, user.id);
    if (!found) {
      return NextResponse.json(
        { error: { code: "not_found", message: "No analysis with that id." } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      analysis: found.analysis,
      property: found.property,
      analysisType: found.access.analysisType,
      locked: !found.access.fullAccess || undefined,
      lockedSections: found.lockedSections,
    });
  } catch (err) {
    console.error(`GET /api/analyses/${id} failed:`, err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not load the analysis." } },
      { status: 500 }
    );
  }
}
