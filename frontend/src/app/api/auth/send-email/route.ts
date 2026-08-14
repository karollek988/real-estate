import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createResendClient, getEmailFrom } from "@/lib/email/resend";
import { verifyStandardWebhookSignature } from "@/lib/email/verifyWebhookSignature";
import {
  renderSignupConfirmationEmail,
  renderGenericAuthEmail,
  type CampaignInfo,
  type CampaignCode,
} from "@/lib/email/confirmationEmail";

export const runtime = "nodejs";

interface SendEmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

function hookError(status: number, message: string) {
  console.error("[Auth Email Hook] ✗", status, message);
  return NextResponse.json({ error: { http_code: status, message } }, { status });
}

async function getCampaignInfo(userId: string): Promise<CampaignInfo | null> {
  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("campaign_enrollments")
    .select("position")
    .eq("user_id", userId)
    .maybeSingle();

  if (!enrollment) return null;

  const { data: codes } = await admin
    .from("discount_codes")
    .select("code, kind")
    .eq("user_id", userId)
    .order("kind", { ascending: true });

  return {
    position: (enrollment as { position: number }).position,
    codes: (codes ?? []) as CampaignCode[],
  };
}

export async function POST(request: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    return hookError(500, "SEND_EMAIL_HOOK_SECRET not configured.");
  }

  const payload = await request.text();
  const verified = verifyStandardWebhookSignature({
    payload,
    headers: {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    secret,
  });

  if (!verified) {
    return hookError(401, "Invalid webhook signature.");
  }

  let body: SendEmailHookPayload;
  try {
    body = JSON.parse(payload);
  } catch {
    return hookError(400, "Invalid JSON payload.");
  }

  const { user, email_data: emailData } = body;
  if (!user?.email || !emailData?.token_hash || !emailData?.email_action_type || !emailData?.site_url) {
    return hookError(400, "Missing required hook fields.");
  }

  const confirmUrl =
    `${emailData.site_url}/auth/confirm` +
    `?token_hash=${encodeURIComponent(emailData.token_hash)}` +
    `&type=${encodeURIComponent(emailData.email_action_type)}` +
    `&next=${encodeURIComponent(emailData.redirect_to || "/dashboard")}`;

  try {
    let subject: string;
    let html: string;

    if (emailData.email_action_type === "signup") {
      const firstName = typeof user.user_metadata?.first_name === "string" ? user.user_metadata.first_name : null;
      const campaign = await getCampaignInfo(user.id);
      ({ subject, html } = renderSignupConfirmationEmail({ firstName, confirmUrl, campaign }));
    } else {
      ({ subject, html } = renderGenericAuthEmail(emailData.email_action_type, confirmUrl));
    }

    const resend = createResendClient();
    const { error: sendError } = await resend.emails.send({
      from: getEmailFrom(),
      to: user.email,
      subject,
      html,
    });

    if (sendError) {
      return hookError(500, `Resend send failed: ${sendError.message}`);
    }

    console.log("[Auth Email Hook] ✓ Sent", emailData.email_action_type, "to", user.email);
    return NextResponse.json({});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return hookError(500, `Unexpected error sending email: ${message}`);
  }
}
