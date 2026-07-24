import { createStripeClient } from "./admin";
import { getPriceId } from "./prices";

export interface CreateCheckoutResult {
  url: string | null;
  sessionId: string;
}

export async function createSubscriptionCheckout(
  customerId: string | undefined,
  priceKey: "premium_monthly",
  userId: string,
  successUrl: string,
  cancelUrl: string
): Promise<CreateCheckoutResult> {
  const stripe = createStripeClient();
  console.log("[Stripe] Getting price ID for:", priceKey);
  const priceId = getPriceId(priceKey);
  console.log("[Stripe] Price ID resolved:", priceId);

  console.log("[Stripe] Creating Checkout Session...");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    managed_payments: { enabled: false },
    ...(customerId ? { customer: customerId } : {}),
    client_reference_id: userId,
    metadata: { userId, priceKey },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  console.log("[Stripe] ✓ Session Created:", session.id);

  return { url: session.url, sessionId: session.id };
}

export async function createOneTimeCheckout(
  customerId: string | undefined,
  priceKey: "premium_analysis",
  userId: string,
  successUrl: string,
  cancelUrl: string,
  unlockAnalysisId?: string
): Promise<CreateCheckoutResult> {
  const stripe = createStripeClient();
  console.log("[Stripe] Getting price ID for:", priceKey);
  const priceId = getPriceId(priceKey);
  console.log("[Stripe] Price ID resolved:", priceId);

  const metadata: Record<string, string> = { userId, priceKey };
  if (unlockAnalysisId) {
    metadata.unlockAnalysisId = unlockAnalysisId;
  }

  console.log("[Stripe] Creating Checkout Session...");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    managed_payments: { enabled: false },
    ...(customerId ? { customer: customerId } : {}),
    client_reference_id: userId,
    metadata,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  console.log("[Stripe] ✓ Session Created:", session.id);

  return { url: session.url, sessionId: session.id };
}
