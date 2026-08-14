import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/requireUser";

interface DiscountCodeRow {
  code: string;
  kind: "premium_analysis" | "premium_subscription";
  status: "active" | "reserved" | "redeemed";
}

/**
 * GET /api/discount-codes — the signed-in user's First 100 Users campaign
 * enrollment status and codes, if any. Uses the admin client (not the
 * user's own RLS-scoped session) purely for consistency with the popup's
 * mark-shown write below, which does need to bypass RLS.
 */
export async function GET() {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const admin = createAdminClient();

  const { data: enrollment } = await admin
    .from("campaign_enrollments")
    .select("position, popup_shown_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ enrolled: false });
  }

  const { data: codes } = await admin
    .from("discount_codes")
    .select("code, kind, status")
    .eq("user_id", user.id)
    .order("kind", { ascending: true });

  return NextResponse.json({
    enrolled: true,
    position: (enrollment as { position: number }).position,
    popupShown: enrollment.popup_shown_at !== null,
    codes: (codes ?? []) as DiscountCodeRow[],
  });
}

/** POST /api/discount-codes — marks the first-login coupon popup as shown for the signed-in user. */
export async function POST() {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const { error } = await createAdminClient().rpc("mark_campaign_popup_shown", { p_user_id: user.id });
  if (error) {
    console.error("POST /api/discount-codes failed:", error);
    return NextResponse.json({ error: { code: "internal_error", message: "Något gick fel." } }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
