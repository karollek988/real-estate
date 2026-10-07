import { DEFAULT_LOCALE, LOCALE_CODES, isLocale, type AppLocale } from "./locales";
import { PATHNAMES, type InternalPathname } from "./pathnames";

/**
 * Plain functions on addresses, for the proxy (which runs before any page) and for tests. No React.
 */

/** "/en/pricing" -> { locale: "en", rest: "/pricing" }; "/priser" -> { locale: "sv", rest: "/priser" }. A "/sv/..." prefix counts as Swedish. */
export function splitLocale(pathname: string): { locale: AppLocale; prefixed: boolean; rest: string } {
  const [, first = "", ...others] = pathname.split("/");
  if (isLocale(first)) return { locale: first, prefixed: true, rest: `/${others.join("/")}`.replace(/\/$/, "") || "/" };
  return { locale: DEFAULT_LOCALE, prefixed: false, rest: pathname };
}

/** Addresses that are not pages with a language: the API, the review console, the sign-in links, Next's own files and the search engines' files. */
export function isLanguageNeutral(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/auth/confirm" ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/__nextjs") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/favicon.ico"
  );
}

const DYNAMIC = /\[([a-z]+)\]/g;

/** A pathname's template as a pattern: "/guider/[slug]" matches "/guider/steg-for-steg" and gives { slug: "steg-for-steg" }. */
function compile(template: string): RegExp {
  return new RegExp(`^${template.replace(DYNAMIC, "([^/]+)")}$`);
}

const KEYS = (Object.keys(PATHNAMES) as InternalPathname[]).map((key) => ({ key, pattern: compile(key), names: [...key.matchAll(DYNAMIC)].map((m) => m[1]) }));

/**
 * Which page an address in the default language is: "/guider/abc" is "/guider/[slug]" with slug "abc".
 * Null for an address that is no page of the site. (The default language's names are the pages' own names.)
 */
export function resolveInternal(pathname: string): { pathname: InternalPathname; params: Record<string, string> } | null {
  const clean = pathname.replace(/\/$/, "") || "/";
  for (const { key, pattern, names } of KEYS) {
    const match = pattern.exec(clean);
    if (match) return { pathname: key, params: Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(match[i + 1])])) };
  }
  return null;
}

export const localeCodes = LOCALE_CODES;
