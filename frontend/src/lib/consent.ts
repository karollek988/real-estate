const STORAGE_KEY = "kopanalys_cookie_consent";

/**
 * Which version of the cookie text a choice was made under. 2 (2026-10): "analys och marknadsföring" now
 * really sets a cookie (ka_src, where a visitor first came from). An "accept" made before that was given
 * for a policy that said no such cookie existed, so it is not carried over: those visitors are asked again.
 * A "decline" stays valid as it is.
 */
export const CONSENT_VERSION = 2;

export interface CookieConsent {
  necessary: true;
  marketing: boolean;
  decidedAt: string;
  /** the version of the cookie text this was decided under; absent on choices from before there were versions */
  v?: number;
}

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed && typeof parsed.marketing === "boolean" && parsed.necessary === true) {
      if (parsed.marketing && (parsed.v ?? 1) < CONSENT_VERSION) return null;
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Fired when the choice changes. `detail.marketing` is the new choice, or null when it was cleared ("Cookie-inställningar"). */
export const CONSENT_CHANGED_EVENT = "kopanalys:cookie-consent-changed";

export interface ConsentChange {
  marketing: boolean | null;
}

export function setCookieConsent(marketing: boolean): void {
  const consent: CookieConsent = {
    necessary: true,
    marketing,
    decidedAt: new Date().toISOString(),
    v: CONSENT_VERSION,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent<ConsentChange>(CONSENT_CHANGED_EVENT, { detail: { marketing } }));
}

export const REOPEN_CONSENT_EVENT = "kopanalys:reopen-cookie-consent";

/** Clears the stored choice and asks the banner to show itself again — the
 *  "Cookie-inställningar" control the privacy policy promises exists. */
export function reopenCookieConsent(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent<ConsentChange>(CONSENT_CHANGED_EVENT, { detail: { marketing: null } }));
  window.dispatchEvent(new Event(REOPEN_CONSENT_EVENT));
}
