import type Stripe from "stripe";
import { createStripeClient } from "./admin";
import { getPriceId, type OneTimePriceKey } from "./prices";

export interface CreateCheckoutResult {
  url: string | null;
  sessionId: string;
}

export type { OneTimePriceKey };

export async function createOneTimeCheckout(
  customerId: string | undefined,
  priceKey: OneTimePriceKey,
  userId: string,
  successUrl: string,
  cancelUrl: string,
  couponId?: string,
  /** Stripe's code for the language of the payment page ("sv", "en", "auto" to let Stripe decide). */
  locale: string = "auto"
): Promise<CreateCheckoutResult> {
  const stripe = createStripeClient();
  console.log("[Stripe] Getting price ID for:", priceKey);
  const priceId = getPriceId(priceKey);
  console.log("[Stripe] Price ID resolved:", priceId);

  console.log("[Stripe] Creating Checkout Session...");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    managed_payments: { enabled: false },
    ...(customerId ? { customer: customerId } : {}),
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    client_reference_id: userId,
    // What the webhook credits is decided from these two values, both set
    // here on the server — never from anything the browser sent afterwards.
    metadata: { userId, priceKey },
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: locale as Stripe.Checkout.SessionCreateParams.Locale,
  });
  console.log("[Stripe] ✓ Session Created:", session.id);

  return { url: session.url, sessionId: session.id };
}
