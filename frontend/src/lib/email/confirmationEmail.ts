// Branded HTML for every email Supabase's Send Email Hook routes through us
// (frontend/src/app/api/auth/send-email/route.ts) — signup confirmation
// (optionally with First 100 Users campaign content) plus password
// recovery, magic link, email change, and reauthentication, so none of
// those silently break once the hook takes over all auth email delivery.

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

function renderShell(preheader: string, bodyHtml: string): string {
  const logoUrl = `${siteUrl()}/kopanalys-bostad-logo.png`;
  return `<!doctype html>
<html lang="sv">
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
                  Köpanalys &middot; Frågor? Skriv till
                  <a href="mailto:info@kopanalys.se" style="color:${BRAND.green}; text-decoration:underline;">info@kopanalys.se</a>
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

const CODE_KIND_LABEL: Record<"premium_analysis" | "premium_subscription", { title: string; explainer: string }> = {
  premium_analysis: {
    title: "50% rabatt på en Premium-analys",
    explainer: "Använd vid köp av en enskild Premium-beslutsanalys — dras av på priset i kassan.",
  },
  premium_subscription: {
    title: "50% rabatt på en Premium-prenumeration",
    explainer: "Använd vid tecknande av en Premium-prenumeration — halverar din första betalning.",
  },
};

export interface CampaignCode {
  code: string;
  kind: "premium_analysis" | "premium_subscription";
}

export interface CampaignInfo {
  position: number;
  codes: CampaignCode[];
}

function renderCampaignBlock(campaign: CampaignInfo): string {
  const codeRows = campaign.codes
    .map((c) => {
      const meta = CODE_KIND_LABEL[c.kind];
      return `<tr>
        <td style="padding:12px 0; border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:#111927;">${escapeHtml(meta.title)}</p>
          <p style="margin:0 0 8px; font-size:12px; color:${BRAND.textMuted};">${escapeHtml(meta.explainer)}</p>
          <code style="display:inline-block; padding:8px 12px; border-radius:8px; background-color:#f0fdf4; border:1px solid #bbf7d0; font-size:14px; font-weight:700; letter-spacing:0.5px; color:${BRAND.green};">${escapeHtml(c.code)}</code>
        </td>
      </tr>`;
    })
    .join("");

  return `<div style="margin:24px 0; padding:20px; border-radius:12px; background-color:#f0fdf4; border:1px solid #bbf7d0;">
    <p style="margin:0 0 12px; font-size:14px; font-weight:700; color:#111927;">
      Du är användare #${campaign.position} av våra första 100 användare och har därför fått 50% rabatt!
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${codeRows}
    </table>
  </div>`;
}

export function renderSignupConfirmationEmail(params: {
  firstName: string | null;
  confirmUrl: string;
  campaign: CampaignInfo | null;
}): { subject: string; html: string } {
  const greetingName = params.firstName?.trim() || "";
  const greeting = greetingName ? `Hej ${escapeHtml(greetingName)}!` : "Hej!";

  const body = `
    <h1 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#111927;">${greeting}</h1>
    <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#374151;">
      Tack för att du skapat ett konto hos Köpanalys! Bekräfta din e-postadress för att komma igång.
    </p>
    ${params.campaign ? renderCampaignBlock(params.campaign) : ""}
    ${ctaButton(params.confirmUrl, "Bekräfta mitt konto")}
    <p style="margin:0; font-size:12px; line-height:1.5; color:${BRAND.textMuted};">
      Om knappen inte fungerar, kopiera in den här länken i din webbläsare:<br />
      <a href="${params.confirmUrl}" style="color:${BRAND.green}; word-break:break-all;">${params.confirmUrl}</a>
    </p>
  `;

  return {
    subject: params.campaign
      ? `Bekräfta ditt konto — du är användare #${params.campaign.position} med 50% rabatt!`
      : "Bekräfta ditt konto hos Köpanalys",
    html: renderShell("Bekräfta din e-postadress för att aktivera ditt Köpanalys-konto.", body),
  };
}

// Supabase's Send Email Hook can carry any of a larger set of
// email_action_type values (invite, email, and several *_notification
// types beyond these) — GENERIC_COPY covers every type this app's UI/API
// can actually trigger today; DEFAULT_COPY is a safe branded fallback for
// anything else, so an action type we didn't anticipate (or one Supabase
// adds later) still gets a real email instead of silently being dropped.
const GENERIC_COPY: Record<string, { subject: string; heading: string; body: string; cta: string }> = {
  recovery: {
    subject: "Återställ ditt lösenord — Köpanalys",
    heading: "Återställ ditt lösenord",
    body: "Vi har fått en begäran om att återställa lösenordet för ditt Köpanalys-konto. Klicka på knappen nedan för att välja ett nytt lösenord.",
    cta: "Återställ lösenord",
  },
  magiclink: {
    subject: "Din inloggningslänk — Köpanalys",
    heading: "Logga in på Köpanalys",
    body: "Klicka på knappen nedan för att logga in på ditt Köpanalys-konto.",
    cta: "Logga in",
  },
  email_change: {
    subject: "Bekräfta din nya e-postadress — Köpanalys",
    heading: "Bekräfta din nya e-postadress",
    body: "Klicka på knappen nedan för att bekräfta att den här e-postadressen ska kopplas till ditt Köpanalys-konto.",
    cta: "Bekräfta e-postadress",
  },
  reauthentication: {
    subject: "Bekräfta din identitet — Köpanalys",
    heading: "Bekräfta din identitet",
    body: "Vi behöver bekräfta att det är du innan vi fortsätter. Klicka på knappen nedan för att fortsätta.",
    cta: "Bekräfta",
  },
  invite: {
    subject: "Du har blivit inbjuden till Köpanalys",
    heading: "Du har blivit inbjuden",
    body: "Klicka på knappen nedan för att skapa ditt Köpanalys-konto.",
    cta: "Skapa konto",
  },
};

const DEFAULT_COPY = {
  subject: "Ett meddelande om ditt Köpanalys-konto",
  heading: "Ett meddelande om ditt konto",
  body: "Klicka på knappen nedan för att fortsätta.",
  cta: "Fortsätt",
};

export function renderGenericAuthEmail(type: string, confirmUrl: string): { subject: string; html: string } {
  const copy = GENERIC_COPY[type] ?? DEFAULT_COPY;
  const body = `
    <h1 style="margin:0 0 12px; font-size:20px; font-weight:700; color:#111927;">${copy.heading}</h1>
    <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:#374151;">${copy.body}</p>
    ${ctaButton(confirmUrl, copy.cta)}
    <p style="margin:0; font-size:12px; line-height:1.5; color:${BRAND.textMuted};">
      Om knappen inte fungerar, kopiera in den här länken i din webbläsare:<br />
      <a href="${confirmUrl}" style="color:${BRAND.green}; word-break:break-all;">${confirmUrl}</a>
    </p>
    <p style="margin:16px 0 0; font-size:12px; line-height:1.5; color:${BRAND.textMuted};">
      Bad du inte om det här? Du kan ignorera det här mejlet.
    </p>
  `;

  return { subject: copy.subject, html: renderShell(copy.body, body) };
}
