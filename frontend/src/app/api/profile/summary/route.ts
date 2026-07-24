import { NextResponse } from "next/server";
import { getProfileSummary } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";

/** GET /api/profile/summary — the 4 profile stat-card numbers for the signed-in user. */
export async function GET() {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const summary = await getProfileSummary(user.id);
    if (!summary) {
      return NextResponse.json(
        { error: { code: "not_found", message: "No profile found for this account." } },
        { status: 404 }
      );
    }
    return NextResponse.json(summary);
  } catch (err) {
    console.error("GET /api/profile/summary failed:", err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not load your profile." } },
      { status: 500 }
    );
  }
}
