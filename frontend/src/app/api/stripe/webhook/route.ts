import { NextResponse } from "next/server";
import { createStripeClient } from "@/lib/stripe/admin";
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionCreatedOrUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from "@/lib/stripe/webhooks";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  console.log("[Webhook] Received event");

  const stripe = createStripeClient();

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.log("[Webhook] ✗ Missing Stripe signature");
    return errorResponse(400, "missing_signature", "No Stripe signature found.");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.log("[Webhook] ✗ STRIPE_WEBHOOK_SECRET not configured");
    return errorResponse(500, "missing_webhook_secret", "STRIPE_WEBHOOK_SECRET not configured.");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log("[Webhook] ✓ Verified — type:", event.type);
  } catch (err) {
    console.error("[Webhook] ✗ Signature verification failed:", err);
    return errorResponse(400, "invalid_signature", "Webhook signature verification failed.");
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        console.log("[Webhook] Handling checkout.session.completed");
        await handleCheckoutSessionCompleted(event.data.object);
        console.log("[Webhook] ✓ checkout.session.completed handled");
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        console.log("[Webhook] Handling", event.type);
        await handleSubscriptionCreatedOrUpdated(event.data.object);
        console.log("[Webhook] ✓", event.type, "handled");
        break;
      }

      case "customer.subscription.deleted": {
        console.log("[Webhook] Handling customer.subscription.deleted");
        await handleSubscriptionDeleted(event.data.object);
        console.log("[Webhook] ✓ customer.subscription.deleted handled");
        break;
      }

      case "invoice.paid": {
        console.log("[Webhook] Handling invoice.paid");
        await handleInvoicePaid(event.data.object);
        console.log("[Webhook] ✓ invoice.paid handled");
        break;
      }

      case "invoice.payment_failed": {
        console.log("[Webhook] Handling invoice.payment_failed");
        await handleInvoicePaymentFailed(event.data.object);
        console.log("[Webhook] ✓ invoice.payment_failed handled");
        break;
      }

      default:
        console.log("[Webhook] Unhandled event type:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[Webhook] ✗ Handler failed for ${event.type}:`, err);
    return errorResponse(500, "webhook_handler_failed", "Webhook handler error.");
  }
}
