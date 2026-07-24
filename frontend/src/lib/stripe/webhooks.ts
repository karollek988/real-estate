import type Stripe from "stripe";
import { createStripeClient } from "./admin";
import { getTierForPriceId } from "./prices";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionTier } from "./prices";

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return "inactive";
  }
}

interface SubscriptionData {
  stripeCustomerId: string;
  subscriptionStatus: string;
  subscriptionTier: SubscriptionTier | null;
  priceId: string | null;
  subscriptionId: string;
  currentPeriodEnd: string | null;
  subscriptionEnd: string | null;
}

function extractSubscriptionData(subscription: Stripe.Subscription): SubscriptionData {
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const tier = priceId ? getTierForPriceId(priceId) : null;
  const periodEnd = item?.current_period_end ?? null;

  return {
    stripeCustomerId: subscription.customer as string,
    subscriptionStatus: mapStripeStatus(subscription.status),
    subscriptionTier: tier,
    priceId,
    subscriptionId: subscription.id,
    currentPeriodEnd: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
    subscriptionEnd: subscription.ended_at
      ? new Date(subscription.ended_at * 1000).toISOString()
      : subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : null,
  };
}

async function upsertProfileSubscription(userId: string, data: SubscriptionData) {
  const admin = createAdminClient();
  console.log("[Webhook] Updating subscription for user:", userId, "tier:", data.subscriptionTier, "status:", data.subscriptionStatus);
  const { error } = await admin
    .from("profiles")
    .update({
      stripe_customer_id: data.stripeCustomerId,
      subscription_status: data.subscriptionStatus,
      subscription_tier: data.subscriptionTier,
      price_id: data.priceId,
      subscription_id: data.subscriptionId,
      current_period_end: data.currentPeriodEnd ? data.currentPeriodEnd : null,
      subscription_end: data.subscriptionEnd ? data.subscriptionEnd : null,
    })
    .eq("id", userId);

  if (error) {
    console.error("[Webhook] ✗ Failed to update subscription for user", userId, ":", error.message);
  } else {
    console.log("[Webhook] ✓ User updated:", userId);
  }
}

function findUserId(subscription: Stripe.Subscription): string | null {
  return subscription.metadata?.userId ?? null;
}

function getCustomerId(session: Stripe.Checkout.Session): string | null {
  const raw = session as unknown as Record<string, unknown>;
  const customer = raw.customer;
  if (typeof customer === "string") return customer;
  if (customer && typeof customer === "object") {
    return (customer as Record<string, string>).id ?? null;
  }
  return null;
}

function getSubscriptionId(session: Stripe.Checkout.Session): string | null {
  const raw = session as unknown as Record<string, unknown>;
  const subscription = raw.subscription;
  if (typeof subscription === "string") return subscription;
  if (subscription && typeof subscription === "object") {
    return (subscription as Record<string, string>).id ?? null;
  }
  return null;
}

export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId ?? session.client_reference_id;
  if (!userId) {
    console.error("[Webhook] ✗ checkout.session.completed: no userId found");
    return;
  }

  const customerId = getCustomerId(session);
  console.log("[Webhook] checkout.session.completed — userId:", userId, "customerId:", customerId, "mode:", session.mode);

  if (customerId) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId);

    if (error) {
      console.error("[Webhook] ✗ Failed to set stripe_customer_id for user", userId, ":", error.message);
    } else {
      console.log("[Webhook] ✓ stripe_customer_id saved for user:", userId);
    }
  }

  if (session.mode === "subscription") {
    const subscriptionId = getSubscriptionId(session);
    if (subscriptionId) {
      console.log("[Webhook] Retrieving subscription:", subscriptionId);
      const stripe = createStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log("[Webhook] Subscription status:", subscription.status);
      await handleSubscriptionCreatedOrUpdated(subscription);
    }
  }

  if (session.mode === "payment" && session.metadata?.priceKey === "premium_analysis") {
    console.log("[Webhook] Processing one-time premium analysis purchase");
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("premium_analyses_remaining")
      .eq("id", userId)
      .maybeSingle();

    const currentRemaining = (profile as { premium_analyses_remaining?: number } | null)
      ?.premium_analyses_remaining ?? 0;

    console.log("[Webhook] Current premium_analyses_remaining:", currentRemaining);

    await adminClient
      .from("profiles")
      .update({ premium_analyses_remaining: currentRemaining + 1 })
      .eq("id", userId);

    console.log("[Webhook] ✓ Added 1 premium analysis to user:", userId);
  }

  console.log("[Webhook] ✓ Purchase Completed for user:", userId);
}

export async function handleSubscriptionCreatedOrUpdated(subscription: Stripe.Subscription) {
  const userId = findUserId(subscription);
  if (!userId) {
    console.error("[Webhook] ✗ subscription event: no userId found in metadata");
    return;
  }

  console.log("[Webhook] subscription event — userId:", userId, "status:", subscription.status);
  const data = extractSubscriptionData(subscription);
  await upsertProfileSubscription(userId, data);
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = findUserId(subscription);
  if (!userId) {
    console.error("[Webhook] ✗ subscription.deleted: no userId found");
    return;
  }

  console.log("[Webhook] subscription.deleted — userId:", userId);

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      subscription_status: "canceled",
      subscription_tier: null,
      price_id: null,
      subscription_id: null,
      subscription_end: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("[Webhook] ✗ Failed to clear subscription for user", userId, ":", error.message);
  } else {
    console.log("[Webhook] ✓ Subscription cleared for user:", userId);
  }
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = invoice as unknown as Record<string, unknown>;
  const subscriptionDetails = raw.subscription_details as Record<string, unknown> | undefined;
  if (subscriptionDetails?.subscription) {
    const sub = subscriptionDetails.subscription;
    return typeof sub === "string" ? sub : (sub as Record<string, string>).id;
  }
  return null;
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    console.log("[Webhook] invoice.paid: no subscription linked, skipping");
    return;
  }

  console.log("[Webhook] invoice.paid — subscriptionId:", subscriptionId);
  const stripe = createStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const userId = findUserId(subscription);
  if (!userId) {
    console.log("[Webhook] invoice.paid: no userId found for subscription");
    return;
  }

  const data = extractSubscriptionData(subscription);
  await upsertProfileSubscription(userId, data);
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    console.log("[Webhook] invoice.payment_failed: no subscription linked, skipping");
    return;
  }

  console.log("[Webhook] invoice.payment_failed — subscriptionId:", subscriptionId);
  const stripe = createStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const userId = findUserId(subscription);
  if (!userId) {
    console.log("[Webhook] invoice.payment_failed: no userId found for subscription");
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ subscription_status: "past_due" })
    .eq("id", userId);

  if (error) {
    console.error("[Webhook] ✗ Failed to mark subscription past_due for user", userId, ":", error.message);
  } else {
    console.log("[Webhook] ✓ Subscription marked past_due for user:", userId);
  }
}
