import { NextResponse } from "next/server";
import { getAnalysisWithProperty } from "@/lib/analysis/store";
import { requireUser } from "@/lib/auth/requireUser";

/** GET /api/analyses/:id — one analysis (any version) with its property. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const found = await getAnalysisWithProperty(id);
    if (!found) {
      return NextResponse.json(
        { error: { code: "not_found", message: "No analysis with that id." } },
        { status: 404 }
      );
    }
    return NextResponse.json(found);
  } catch (err) {
    console.error(`GET /api/analyses/${id} failed:`, err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not load the analysis." } },
      { status: 500 }
    );
  }
}
