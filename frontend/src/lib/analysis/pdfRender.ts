import type { CookieParam } from "puppeteer-core";

/**
 * Small helpers for the PDF route (app/api/analyses/[id]/pdf/route.ts), kept apart so pdfRender.verify.mjs can
 * check them without launching a browser.
 */

/**
 * The request's cookies as cookies of this site only. The headless browser that prints the report needs the
 * caller's session to get past the sign-in gate, but it must not be handed the cookies as an extra HTTP header:
 * a header goes to every host the page contacts, and the report loads the listing's photos from the listing
 * site's own servers. A cookie set for one origin goes to that origin only.
 */
export function cookiesForOrigin(header: string | null, origin: string): CookieParam[] {
  if (!header) return [];
  const cookies: CookieParam[] = [];
  for (const pair of header.split(";")) {
    const trimmed = pair.trim();
    const eq = trimmed.indexOf("=");
    if (eq > 0) cookies.push({ name: trimmed.slice(0, eq), value: trimmed.slice(eq + 1), url: origin });
  }
  return cookies;
}

/** A URL for the log: the host and the start of the path, never a query string (it may carry a token). */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname.slice(0, 40)}`;
  } catch {
    return url.slice(0, 60);
  }
}
