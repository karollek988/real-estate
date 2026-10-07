/**
 * The analytics cookie that remembers where a visitor first came from (ka_src), and only that.
 *
 * It is set only after the visitor has accepted "analys och marknadsföring" in the cookie banner, and is
 * removed again when they decline or reopen their choice. Its whole content is one channel and one source
 * name ("seo.google"): no identifier, no address, no page. What is for the server's counting and what
 * is kept is in the migration 20261007000000_acquisition_analytics.sql and on /privacy.
 */
import { decodeSource, encodeSource, type SourceInfo } from "./source";

export const SOURCE_COOKIE = "ka_src";
export const SOURCE_COOKIE_DAYS = 90;

/** The source in a `document.cookie` string, or null when there is no (valid) ka_src. */
export function readSourceCookie(cookieString: string): SourceInfo | null {
  for (const part of cookieString.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SOURCE_COOKIE) return decodeSource(value.join("="));
  }
  return null;
}

/** The text to assign to `document.cookie` to set the cookie. */
export function sourceCookieText(info: SourceInfo, secure: boolean): string {
  return `${SOURCE_COOKIE}=${encodeSource(info)}; Max-Age=${SOURCE_COOKIE_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** The text that removes it. */
export const clearedSourceCookieText = (secure: boolean): string => `${SOURCE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;

/** Visitors who have asked their browser not to be tracked (Do Not Track, Global Privacy Control) are never counted or given the cookie. */
export function privacySignalOn(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  return nav.doNotTrack === "1" || nav.msDoNotTrack === "1" || nav.globalPrivacyControl === true;
}
