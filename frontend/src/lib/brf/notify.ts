import { createAdminClient } from "@/lib/supabase/admin";
import { createResendClient, getEmailFrom } from "@/lib/email/resend";
import { renderNotificationEmail } from "@/lib/email/confirmationEmail";
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type AppLocale } from "@/i18n/locales";
import { getPathname } from "@/i18n/navigation";
import { latestCompleteAnalysis } from "@/lib/analysis/store";
import { dueSv } from "@/lib/report/brfChapter";
import type { BrfReviewRecord, EnsureReviewReason } from "./reviews";

/**
 * The two emails the BRF review needs so the 24-hour promise can be kept:
 *  - to the team when a review round opens (a purchase, or a new annual report);
 *  - to every customer who owns the full analysis when the review is published.
 *
 * Sent only in production (or with BRF_REVIEW_EMAILS=on), so local testing
 * never emails real people; otherwise the email is logged instead. A failed
 * email never fails the request that triggered it — callers catch and log.
 */

function emailsEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && (process.env.NODE_ENV === "production" || process.env.BRF_REVIEW_EMAILS === "on");
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://kopanalys.se").replace(/\/$/, "");
}

/** Where review requests go. KOPANALYS_TEAM_EMAILS (comma separated), else the shared team inbox. */
function teamRecipients(): string[] {
  return (process.env.KOPANALYS_TEAM_EMAILS ?? "kopanalys@gmail.com")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

async function send(to: string[], subject: string, html: string): Promise<void> {
  if (to.length === 0) return;
  if (!emailsEnabled()) {
    console.info(`[brf-review] email not sent outside production: "${subject}" to ${to.join(", ")}`);
    return;
  }
  const { error } = await createResendClient().emails.send({ from: getEmailFrom(), to, subject, html });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
}

async function propertyLabel(propertyId: string): Promise<{ address: string; association: string | null }> {
  const { data } = await createAdminClient().from("properties").select("address, attributes").eq("id", propertyId).maybeSingle();
  const row = data as { address: string; attributes: Record<string, unknown> } | null;
  const association = typeof row?.attributes?.housing_association === "string" ? (row.attributes.housing_association as string) : null;
  return { address: row?.address ?? "okänd adress", association };
}

const REASON_SV: Record<EnsureReviewReason, string> = {
  purchase: "En kund har köpt ett Trygghetspaket.",
  document: "En ny årsredovisning har laddats upp.",
  report_view: "En kund har öppnat en rapport som saknade granskning.",
  analysis: "En rapport väntar på att granskas och släppas till kunden.",
};

export async function notifyTeamOfBrfReview(review: BrfReviewRecord, reason: EnsureReviewReason): Promise<void> {
  const { address, association } = await propertyLabel(review.propertyId);
  const due = dueSv(review.dueAt) ?? "inom 24 timmar";
  const url = `${siteUrl()}/admin/brf/${review.propertyId}`;
  await send(
    teamRecipients(),
    `BRF-granskning: ${address} — klar senast ${due}`,
    await renderNotificationEmail({
      preheader: `Ny BRF-granskning för ${address}`,
      heading: "Ny BRF-granskning",
      paragraphs: [
        REASON_SV[reason],
        `${address}${association ? ` (${association})` : ""}.`,
        review.brfReportId
          ? "Årsredovisningen finns uppladdad i granskningsverktyget."
          : "Ingen årsredovisning är uppladdad än — den behöver tas fram och laddas upp.",
        `Kunden har utlovats BRF-analysen senast ${due}.`,
      ],
      ctaUrl: url,
      ctaLabel: "Öppna granskningen",
    })
  );
}

/** Emails each customer who owns the full analysis of this property. Returns how many were emailed. */
export async function notifyCustomersOfPublishedBrf(propertyId: string): Promise<number> {
  const client = createAdminClient();
  const { data: requests, error } = await client
    .from("analysis_requests")
    .select("user_id, analysis_id")
    .eq("property_id", propertyId)
    .eq("analysis_type", "full")
    .is("refunded_at", null);
  if (error) throw new Error(`notifyCustomersOfPublishedBrf failed: ${error.message}`);
  const rows = (requests ?? []) as Array<{ user_id: string; analysis_id: string }>;
  if (rows.length === 0) return 0;

  // Whoever still waits for a report that has not been released yet hears from us when that one is released.
  const { data: waiting, error: waitingError } = await client
    .from("analyses")
    .select("id")
    .in("id", [...new Set(rows.map((r) => r.analysis_id))])
    .is("released_at", null);
  if (waitingError) throw new Error(`notifyCustomersOfPublishedBrf failed: ${waitingError.message}`);
  const stillWaiting = new Set(((waiting ?? []) as Array<{ id: string }>).map((a) => a.id));
  const userIds = [...new Set(rows.filter((r) => !stillWaiting.has(r.analysis_id)).map((r) => r.user_id))];
  if (userIds.length === 0) return 0;

  const analysis = await latestCompleteAnalysis(propertyId, ["full"], { releasedOnly: true });
  const { address } = await propertyLabel(propertyId);
  // the link and the words are in each customer's own language
  const link = (locale: AppLocale) =>
    `${siteUrl()}${getPathname({ locale, href: analysis ? { pathname: "/report", query: { id: analysis.id } } : "/dashboard" })}`;

  let sent = 0;
  for (const userId of userIds) {
    const { data, error: userError } = await client.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (userError || !email) continue;
    const stored = data?.user?.user_metadata?.locale;
    const locale: AppLocale = isLocale(stored) ? stored : DEFAULT_LOCALE;
    const t = await getTranslations({ locale, namespace: "emails.brfReady" });
    await send(
      [email],
      t("subject", { address }),
      await renderNotificationEmail({
        preheader: t("preheader"),
        heading: t("heading"),
        paragraphs: [t("intro", { address }), t("body")],
        ctaUrl: link(locale),
        ctaLabel: t("cta"),
        locale,
      })
    );
    sent += 1;
  }
  return sent;
}
