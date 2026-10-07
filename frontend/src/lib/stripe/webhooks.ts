import type Stripe from "stripe";
import { getOneTimeProduct, isOneTimePriceKey } from "./prices";
import { createAdminClient } from "@/lib/supabase/admin";

function getCustomerId(session: Stripe.Checkout.Session): string | null {
  const raw = session as unknown as Record<string, unknown>;
  const customer = raw.customer;
  if (typeof customer === "string") return customer;
  if (customer && typeof customer === "object") {
    return (customer as Record<string, string>).id ?? null;
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

  // Only a session that is actually settled delivers anything. For card
  // payments that is always true by the time this event fires; the check
  // exists so a delayed payment method, if one is ever enabled, can't credit
  // an unpaid order. ("no_payment_required" is a fully discounted order.)
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    console.log("[Webhook] checkout.session.completed with payment_status", session.payment_status, "— nothing credited");
    return;
  }

  const admin = createAdminClient();
  const { error: finalizeError } = await admin.rpc("finalize_discount_code", { p_session_id: session.id });
  if (finalizeError) {
    console.error("[Webhook] ✗ Failed to finalize discount code for session", session.id, ":", finalizeError.message);
  }

  if (customerId) {
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

  // What was bought is decided by the priceKey our own checkout route wrote
  // into the session's metadata when it created it (never by anything the
  // browser sent), and what that key is worth by getOneTimeProduct.
  //
  // "premium_analysis" is the key a checkout carried before the packages
  // launched (one analysis for one property = one Trygghetspaket). A customer
  // who started that checkout before the deploy and pays after it has paid for
  // exactly that, so it is credited as one — never dropped.
  const rawPriceKey = session.metadata?.priceKey;
  const priceKey = rawPriceKey === "premium_analysis" ? "trygghetspaket" : rawPriceKey;
  if (session.mode !== "payment" || !isOneTimePriceKey(priceKey)) {
    if (session.mode === "payment") {
      // A paid session we can't map to a package is money taken for nothing
      // delivered — this must be noticed and fixed by hand, so it is an error.
      console.error("[Webhook] ✗ PAID checkout session", session.id, "has no recognised priceKey:", rawPriceKey, "— nothing credited, needs manual handling");
    } else {
      console.log("[Webhook] checkout.session.completed is not a package purchase (mode:", session.mode, ") — nothing credited");
    }
    return;
  }

  const { label, credits } = getOneTimeProduct(priceKey);
  console.log("[Webhook] Processing package purchase:", label, "credits:", credits);

  // One transaction in the database: records the session in the purchase
  // ledger and adds the credits. Stripe delivers events at least once, so a
  // repeated delivery of this same session finds the ledger row and credits
  // nothing the second time. If this throws, the handler fails, the route
  // answers 500, and Stripe retries the delivery.
  const { data: granted, error: grantError } = await admin.rpc("grant_purchase_credits", {
    p_session_id: session.id,
    p_user_id: userId,
    p_price_key: priceKey,
    p_full: credits.full,
    p_area: credits.area,
  });
  if (grantError) {
    throw new Error(`grant_purchase_credits failed for session ${session.id}: ${grantError.message}`);
  }

  console.log(
    granted
      ? `[Webhook] ✓ Credited ${label} to user ${userId}`
      : `[Webhook] Session ${session.id} was already credited — repeated delivery, nothing added`
  );
}

// Checkout Sessions expire (24h by default) if the user never pays — release
// any discount code reserved for that session back to 'active' so it isn't
// burned by an abandoned checkout.
export async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  console.log("[Webhook] checkout.session.expired — sessionId:", session.id);
  const admin = createAdminClient();
  const { error } = await admin.rpc("release_discount_code", { p_session_id: session.id });
  if (error) {
    console.error("[Webhook] ✗ Failed to release discount code for session", session.id, ":", error.message);
  } else {
    console.log("[Webhook] ✓ Released any discount code reserved for expired session:", session.id);
  }
}
