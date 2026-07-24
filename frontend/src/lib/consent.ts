const STORAGE_KEY = "kopanalys_cookie_consent";

export interface CookieConsent {
  necessary: true;
  marketing: boolean;
  decidedAt: string;
}

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed && typeof parsed.marketing === "boolean" && parsed.necessary === true) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setCookieConsent(marketing: boolean): void {
  const consent: CookieConsent = {
    necessary: true,
    marketing,
    decidedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
}

export const REOPEN_CONSENT_EVENT = "kopanalys:reopen-cookie-consent";

/** Clears the stored choice and asks the banner to show itself again — the
 *  "Cookie-inställningar" control the privacy policy promises exists. */
export function reopenCookieConsent(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(REOPEN_CONSENT_EVENT));
}
