"use client";

import { useTranslations } from "next-intl";
import { reopenCookieConsent } from "@/lib/consent";

/** Inline cookie settings link for use inside the site footer.
 *  Reuses the same reopenCookieConsent() that CookieSettingsLink.tsx uses. */
export function CookieSettingsLinkInline() {
  const t = useTranslations("consent");
  return (
    <button
      type="button"
      onClick={reopenCookieConsent}
      className="cursor-pointer text-[12.5px] text-white/50 underline underline-offset-2 transition hover:text-ka-ink"
    >
      {t("settings")}
    </button>
  );
}
