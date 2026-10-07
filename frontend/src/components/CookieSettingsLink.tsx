"use client";

import { useTranslations } from "next-intl";
import { reopenCookieConsent } from "@/lib/consent";

/** Persistent, unobtrusive control so users can reopen the cookie banner and
 *  change their choice later — what the privacy policy's section on withdrawing
 *  consent promises exists. */
export function CookieSettingsLink() {
  const t = useTranslations("consent");
  return (
    <button
      type="button"
      onClick={reopenCookieConsent}
      className="fixed bottom-3 left-3 z-[80] cursor-pointer rounded-lg bg-black/40 px-3 py-1.5 text-xs text-neutral-400 backdrop-blur-sm transition hover:text-neutral-200"
    >
      {t("settings")}
    </button>
  );
}
