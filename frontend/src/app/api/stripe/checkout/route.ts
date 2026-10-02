import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOneTimeCheckout } from "@/lib/stripe/checkout";
import {
  getCouponId,
  isOneTimePriceKey,
  type DiscountCodeKind,
  type OneTimePriceKey,
} from "@/lib/stripe/prices";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Each call creates a Stripe Checkout Session (and may reserve a discount
// code), so cap how fast one connection can do that. Far above what a person
// buying a package ever needs.
const RATE_LIMIT_PER_10_MINUTES = 20;

// Maps a checkout priceKey to the discount_codes.kind it accepts a code for.
// The "Tre bostäder" package takes no code (a code on top of its per-property
// discount isn't part of the offer).
const PRICE_KEY_TO_DISCOUNT_KIND: Partial<Record<OneTimePriceKey, DiscountCodeKind>> = {
  omradesanalys: "omradesanalys",
  trygghetspaket: "trygghetspaket",
};

/**
 * Atomically reserves a discount code (active -> reserved) for this purchase
 * and resolves the matching Stripe Coupon id. Throws if the code is invalid,
 * already used, or doesn't match this priceKey — the RPC gives no row back in
 * every one of those cases, so callers can't distinguish why a code failed
 * and probe for valid ones.
 */
async function reserveDiscountCode(
  userId: string,
  priceKey: OneTimePriceKey,
  discountCode: string
): Promise<{ codeId: string; couponId: string }> {
  const kind = PRICE_KEY_TO_DISCOUNT_KIND[priceKey];
  if (!kind) {
    throw new Error("This purchase doesn't accept a discount code.");
  }

  const admin = createAdminClient();
  const { data: codeId, error } = await admin.rpc("redeem_discount_code", {
    p_user_id: userId,
    p_code: discountCode.trim().toUpperCase(),
    p_kind: kind,
  });

  if (error) {
    throw new Error(`Could not validate discount code: ${error.message}`);
  }
  if (!codeId) {
    throw new Error("Ogiltig eller redan använd rabattkod.");
  }

  return { codeId: codeId as string, couponId: getCouponId(kind) };
}

export async function POST(request: Request) {
  const { user, response: authError } = await requireUser();
  if (authError) {
    console.log("[Stripe Checkout] ✗ Unauthorized request");
    return authError;
  }

  if (!checkRateLimit(`checkout:${clientIp(request)}`, RATE_LIMIT_PER_10_MINUTES, 10 * 60_000)) {
    return errorResponse(429, "rate_limited", "För många försök – vänta en liten stund och försök igen.");
  }

  console.log("[Stripe Checkout] Starting checkout for user:", user.id);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    console.log("[Stripe Checkout] ✗ Invalid request body");
    return errorResponse(400, "invalid_request", "Invalid request body.");
  }

  const { priceKey, discountCode } = body as { priceKey?: unknown; discountCode?: unknown };

  if (typeof priceKey !== "string") {
    console.log("[Stripe Checkout] ✗ Missing or invalid priceKey");
    return errorResponse(400, "invalid_request", "priceKey is required.");
  }
  // Checked before a discount code is touched, so an unknown key can never
  // leave a code reserved.
  if (!isOneTimePriceKey(priceKey)) {
    console.log("[Stripe Checkout] ✗ Unknown price key:", priceKey);
    return errorResponse(400, "invalid_price_key", "Unknown price key.");
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
  const successUrl = `${origin}/buy?checkout=success`;
  const cancelUrl = `${origin}/buy?checkout=cancel`;

  let reservedCode: { codeId: string; couponId: string } | null = null;
  if (typeof discountCode === "string" && discountCode.trim()) {
    console.log("[Stripe Checkout] Reserving discount code for:", priceKey);
    try {
      reservedCode = await reserveDiscountCode(user.id, priceKey, discountCode);
      console.log("[Stripe Checkout] ✓ Discount code reserved:", reservedCode.codeId);
    } catch (err) {
      console.log("[Stripe Checkout] ✗ Discount code rejected:", err instanceof Error ? err.message : err);
      return errorResponse(400, "invalid_discount_code", "Ogiltig eller redan använd rabattkod.");
    }
  }

  try {
    console.log("[Stripe Checkout] Creating one-time checkout for:", priceKey);
    const result = await createOneTimeCheckout(
      customerId,
      priceKey,
      user.id,
      successUrl,
      cancelUrl,
      reservedCode?.couponId
    );

    if (reservedCode) {
      const { error: attachError } = await admin.rpc("attach_discount_code_session", {
        p_code_id: reservedCode.codeId,
        p_session_id: result.sessionId,
      });
      if (attachError) {
        console.error("[Stripe Checkout] ✗ Failed to attach discount code to session:", attachError.message);
      }
    }

    console.log("[Stripe Checkout] ✓ Session created:", result.sessionId);
    console.log("[Stripe Checkout] Redirecting user to:", result.url);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Stripe Checkout] ✗ Failed to create checkout session:", err);
    if (reservedCode) await releaseReservedCode(admin, reservedCode.codeId);
    // The detail stays in the server log: it can name a missing environment
    // variable or a Stripe error, neither of which belongs in a response.
    return errorResponse(500, "checkout_failed", "Kunde inte starta betalningen. Försök igen om en stund.");
  }
}

// Reverts a reservation made just before a Stripe call that then failed,
// before a session id ever existed to release_discount_code() by — direct
// update guarded the same way (status must still be 'reserved') so this
// can't clobber a code that was somehow already finalized/released elsewhere.
async function releaseReservedCode(admin: ReturnType<typeof createAdminClient>, codeId: string) {
  const { error } = await admin
    .from("discount_codes")
    .update({ status: "active", reserved_at: null, stripe_checkout_session_id: null })
    .eq("id", codeId)
    .eq("status", "reserved");
  if (error) {
    console.error("[Stripe Checkout] ✗ Failed to release reserved discount code:", error.message);
  }
}
