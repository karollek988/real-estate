import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function createStripeClient(): Stripe {
  if (typeof window !== "undefined") {
    throw new Error("createStripeClient must only be called on the server");
  }

  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }
    stripeClient = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }

  return stripeClient;
}
