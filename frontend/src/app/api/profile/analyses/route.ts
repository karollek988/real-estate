import { NextResponse } from "next/server";
import { listAnalysisRequestsForUser } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";

/** GET /api/profile/analyses — the signed-in user's own analyses, newest request first. */
export async function GET() {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const analyses = await listAnalysisRequestsForUser(user.id);
    return NextResponse.json({ analyses });
  } catch (err) {
    console.error("GET /api/profile/analyses failed:", err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not load your analyses." } },
      { status: 500 }
    );
  }
}
