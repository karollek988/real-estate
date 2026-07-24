import { createStripeClient } from "./admin";

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = createStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}
