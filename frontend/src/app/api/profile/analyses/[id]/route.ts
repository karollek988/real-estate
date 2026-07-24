import { NextResponse } from "next/server";
import { deleteAnalysisRequest } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";

/**
 * DELETE /api/profile/analyses/:id — removes one analysis from the
 * signed-in user's profile ("Delete report"). :id is an analysis_requests
 * row id, not an analysis id — this only removes the caller's ownership
 * row, never the shared analysis/property row other users may still rely
 * on (it is append-only and DB-blocked from deletion by design).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const deleted = await deleteAnalysisRequest(user.id, id);
    if (!deleted) {
      return NextResponse.json(
        { error: { code: "not_found", message: "No analysis with that id in your profile." } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`DELETE /api/profile/analyses/${id} failed:`, err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not delete the analysis." } },
      { status: 500 }
    );
  }
}
