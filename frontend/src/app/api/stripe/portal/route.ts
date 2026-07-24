import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBillingPortalSession } from "@/lib/stripe/portal";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const customerId = (profile as { stripe_customer_id: string | null } | null)?.stripe_customer_id;

  if (!customerId) {
    return errorResponse(400, "no_customer", "No Stripe customer found. Purchase a subscription first.");
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3001";
  const returnUrl = `${origin}/dashboard/settings`;

  try {
    const url = await createBillingPortalSession(customerId, returnUrl);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("POST /api/stripe/portal failed:", err);
    return errorResponse(500, "portal_failed", "Could not create billing portal session.");
  }
}
