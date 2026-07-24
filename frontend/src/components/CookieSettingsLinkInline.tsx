"use client";

import { reopenCookieConsent } from "@/lib/consent";

/** Inline "Cookie-inställningar" link for use inside the site footer.
 *  Reuses the same reopenCookieConsent() that CookieSettingsLink.tsx uses. */
export function CookieSettingsLinkInline() {
  return (
    <button
      type="button"
      onClick={reopenCookieConsent}
      className="cursor-pointer text-[12px] text-neutral-500 underline underline-offset-2 transition hover:text-neutral-300"
    >
      Cookie-inställningar
    </button>
  );
}
