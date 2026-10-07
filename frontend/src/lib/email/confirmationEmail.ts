// Branded HTML for every email Supabase's Send Email Hook routes through us
// (frontend/src/app/api/auth/send-email/route.ts) — signup confirmation plus
// password recovery, magic link, email change, and reauthentication, so none
// of those silently break once the hook takes over all auth email delivery.
//
// The words are in the "emails" messages (src/i18n/messages/<language>/emails.ts); each function takes the
// language the e-mail is written in.

import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, type AppLocale } from "@/i18n/locales";
import type { Translator } from "@/i18n/translator";

const BRAND = {
  darkBg: "#111927",
  green: "#16a34a",
  textMuted: "#94a3b8",
} as const;

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://kopanalys.se";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderShell(locale: AppLocale, t: Translator, preheader: string, bodyHtml: string): string {
  const logoUrl = `${siteUrl()}/kopanalys-bostad-logo.png`;
  return `<!doctype html>
<html lang="${LOCALES[locale].htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Köpanalys</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb;">
            <tr>
              <td align="center" style="background-color:${BRAND.darkBg}; padding:32px 24px;">
                <img src="${logoUrl}" alt="Köpanalys" height="32" style="height:32px; width:auto; display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px; border-top:1px solid #e5e7eb; background-color:#fafafa;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:${BRAND.textMuted};">
                  Köpanalys &middot; ${escapeHtml(t("footer"))}
                  <a href="mailto:kontakt@kopanalys.se" style="color:${BRAND.green}; text-decoration:underline;">kontakt@kopanalys.se</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td align="center" style="border-radius:12px; background-color:${BRAND.green};">
        <a href="${url}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

/** The small print under a button: the same address as plain text, for when the button does not work. */
function fallbackLink(t: Translator, url: string): string {
  return `<p style="margin:0; font-size:12px; line-height:1.5; color:${BRAND.textMuted};">
      ${escapeHtml(t("fallbackLink"))}<br />
      <a href="${url}" style="color:${BRAND.green}; word-break:break-all;">${url}</a>
    </p>`;
}

async function emailTexts(locale: AppLocale): Promise<Translator & { has: (key: string) => boolean }> {
  return (await getTranslations({ locale, namespace: "emails" })) as unknown as Translator & { has: (key: string) => boolean };
}

export async function renderSignupConfirmationEmail(params: {
  firstName: string | null;
  confirmUrl: string;
  locale?: AppLocale;
}): Promise<{ subject: string; html: string }> {
  const locale = params.locale ?? DEFAULT_LOCALE;
  const t = await emailTexts(locale);
  const greetingName = params.firstName?.trim() || "";
  const greeting = greetingName ? escapeHtml(t("signup.greetingNamed", { name: greetingName })) : escapeHtml(t("signup.greeting"));

  const body = `
    <h1 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#111927;">${greeting}</h1>
    <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#374151;">
      ${escapeHtml(t("signup.body"))}
    </p>
    ${ctaButton(params.confirmUrl, t("signup.button"))}
    ${fallbackLink(t, params.confirmUrl)}
  `;

  return {
    subject: t("signup.subject"),
    html: renderShell(locale, t, t("signup.preheader"), body),
  };
}

/**
 * A short branded notification with one call to action — the BRF review emails (lib/brf/notify.ts).
 * The paragraphs, the heading and the button are already in the language of the e-mail; `locale` decides the
 * fixed words around them (the footer, the line under the button). The team's e-mails are in Swedish.
 */
export async function renderNotificationEmail(params: {
  preheader: string;
  heading: string;
  paragraphs: string[];
  ctaUrl: string;
  ctaLabel: string;
  locale?: AppLocale;
}): Promise<string> {
  const locale = params.locale ?? DEFAULT_LOCALE;
  const t = await emailTexts(locale);
  const body = `
    <h1 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#111927;">${escapeHtml(params.heading)}</h1>
    ${params.paragraphs
      .map((p) => `<p style="margin:0 0 10px; font-size:15px; line-height:1.6; color:#374151;">${escapeHtml(p)}</p>`)
      .join("\n")}
    ${ctaButton(params.ctaUrl, params.ctaLabel)}
    ${fallbackLink(t, params.ctaUrl)}
  `;
  return renderShell(locale, t, params.preheader, body);
}

/**
 * The other account e-mails (password recovery, magic link, email change, reauthentication, invite). Supabase's
 * Send Email Hook can carry any of a larger set of email_action_type values — the messages cover every type
 * this app's UI/API can actually trigger today; "other" is a safe branded fallback for anything else, so an
 * action type we didn't anticipate (or one Supabase adds later) still gets a real email instead of silently
 * being dropped.
 */
export async function renderGenericAuthEmail(
  type: string,
  confirmUrl: string,
  locale: AppLocale = DEFAULT_LOCALE,
): Promise<{ subject: string; html: string }> {
  const t = await emailTexts(locale);
  const kind = t.has(`account.${type}.subject`) ? type : "other";
  const copy = {
    subject: t(`account.${kind}.subject`),
    heading: t(`account.${kind}.heading`),
    body: t(`account.${kind}.body`),
    cta: t(`account.${kind}.cta`),
  };
  const body = `
    <h1 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#111927;">${escapeHtml(copy.heading)}</h1>
    <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#374151;">${escapeHtml(copy.body)}</p>
    ${ctaButton(confirmUrl, copy.cta)}
    ${fallbackLink(t, confirmUrl)}
    <p style="margin:16px 0 0; font-size:12px; line-height:1.5; color:${BRAND.textMuted};">
      ${escapeHtml(t("ignore"))}
    </p>
  `;

  return { subject: copy.subject, html: renderShell(locale, t, copy.body, body) };
}
