import { NextResponse } from "next/server";
import { deleteAnalysisRequest } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";
import { apiError } from "@/i18n/apiText";

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
      return await apiError(404, "not_found", "profile.analysisNotFound");
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(`DELETE /api/profile/analyses/${id} failed:`, err);
    return await apiError(500, "internal_error", "profile.analysisDeleteFailed");
  }
}
