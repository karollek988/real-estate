import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSubscriptionCheckout,
  createOneTimeCheckout,
} from "@/lib/stripe/checkout";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const ALLOWED_SUBSCRIPTIONS = ["premium_monthly", "ultra_monthly"] as const;
const ALLOWED_ONE_TIME = ["premium_analysis"] as const;

export async function POST(request: Request) {
  const { user, response: authError } = await requireUser();
  if (authError) {
    console.log("[Stripe Checkout] ✗ Unauthorized request");
    return authError;
  }

  console.log("[Stripe Checkout] Starting checkout for user:", user.id);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    console.log("[Stripe Checkout] ✗ Invalid request body");
    return errorResponse(400, "invalid_request", "Invalid request body.");
  }

  const { priceKey } = body as { priceKey?: unknown };

  if (typeof priceKey !== "string") {
    console.log("[Stripe Checkout] ✗ Missing or invalid priceKey");
    return errorResponse(400, "invalid_request", "priceKey is required.");
  }

  console.log("[Stripe Checkout] Price key requested:", priceKey);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const customerId = (profile as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? undefined;
  console.log("[Stripe Checkout] Customer ID:", customerId ?? "none (will create guest checkout)");

  const origin = request.headers.get("origin") ?? "http://localhost:3001";
  const successUrl = `${origin}/dashboard/buy?checkout=success`;
  const cancelUrl = `${origin}/dashboard/buy?checkout=cancel`;

  try {
    if ((ALLOWED_SUBSCRIPTIONS as readonly string[]).includes(priceKey)) {
      console.log("[Stripe Checkout] Creating subscription checkout for:", priceKey);
      const result = await createSubscriptionCheckout(
        customerId,
        priceKey as "premium_monthly" | "ultra_monthly",
        user.id,
        successUrl,
        cancelUrl
      );
      console.log("[Stripe Checkout] ✓ Subscription session created:", result.sessionId);
      console.log("[Stripe Checkout] Redirecting user to:", result.url);
      return NextResponse.json(result);
    }

    if ((ALLOWED_ONE_TIME as readonly string[]).includes(priceKey)) {
      console.log("[Stripe Checkout] Creating one-time checkout for:", priceKey);
      const result = await createOneTimeCheckout(
        customerId,
        priceKey as "premium_analysis",
        user.id,
        successUrl,
        cancelUrl
      );
      console.log("[Stripe Checkout] ✓ One-time session created:", result.sessionId);
      console.log("[Stripe Checkout] Redirecting user to:", result.url);
      return NextResponse.json(result);
    }

    console.log("[Stripe Checkout] ✗ Unknown price key:", priceKey);
    return errorResponse(400, "invalid_price_key", `Unknown price key: ${priceKey}`);
  } catch (err) {
    console.error("[Stripe Checkout] ✗ Failed to create checkout session:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(500, "checkout_failed", `Could not create checkout session: ${message}`);
  }
}
