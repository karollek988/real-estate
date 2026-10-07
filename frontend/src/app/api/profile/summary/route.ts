import { NextResponse } from "next/server";
import { getProfileSummary } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";
import { apiError } from "@/i18n/apiText";

/** GET /api/profile/summary — the 4 profile stat-card numbers for the signed-in user. */
export async function GET() {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const summary = await getProfileSummary(user.id);
    if (!summary) {
      return await apiError(404, "not_found", "profile.notFound");
    }
    return NextResponse.json(summary);
  } catch (err) {
    console.error("GET /api/profile/summary failed:", err);
    return await apiError(500, "internal_error", "profile.loadFailed");
  }
}
