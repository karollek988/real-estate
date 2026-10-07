import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/requireUser";
import { apiError } from "@/i18n/apiText";

interface DiscountCodeRow {
  code: string;
  kind: "trygghetspaket" | "omradesanalys";
  status: "active" | "reserved" | "redeemed";
}

/**
 * GET /api/discount-codes — the signed-in user's own discount codes.
 *
 * Codes are issued on purpose (issue_discount_code() in the database) and
 * redeemed at checkout; there is no campaign that hands them out. Only kinds
 * that can still be redeemed are listed: a code issued for a subscription is
 * left out because subscriptions are no longer sold.
 *
 * Reads through the admin client but is scoped to the session's own user id —
 * a user can only ever list their own codes.
 */
export async function GET() {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const { data: codes, error } = await createAdminClient()
    .from("discount_codes")
    .select("code, kind, status")
    .eq("user_id", user.id)
    .in("kind", ["trygghetspaket", "omradesanalys"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("GET /api/discount-codes failed:", error);
    return await apiError(500, "internal_error", "profile.discountCodesLoadFailed");
  }

  return NextResponse.json({ codes: (codes ?? []) as DiscountCodeRow[] });
}
