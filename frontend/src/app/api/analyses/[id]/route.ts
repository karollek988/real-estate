import { NextResponse } from "next/server";
import { getAnalysisWithProperty } from "@/lib/analysis/store";
import { requireUser } from "@/lib/auth/requireUser";
import { getAnalysisRequestRow } from "@/lib/analysis/ownership";

/** GET /api/analyses/:id — one analysis (any version) with its property. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const found = await getAnalysisWithProperty(id);
    if (!found) {
      return NextResponse.json(
        { error: { code: "not_found", message: "No analysis with that id." } },
        { status: 404 }
      );
    }

    const requestRow = user ? await getAnalysisRequestRow(user.id, id) : null;
    const locked = requestRow !== null && requestRow.analysisType === "premium" && !requestRow.unlocked;

    return NextResponse.json({ ...found, locked: locked || undefined });
  } catch (err) {
    console.error(`GET /api/analyses/${id} failed:`, err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not load the analysis." } },
      { status: 500 }
    );
  }
}
