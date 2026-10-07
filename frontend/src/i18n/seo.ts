import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, LOCALE_CODES, type AppLocale } from "./locales";
import { getPathname } from "./navigation";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://kopanalys.se").replace(/\/$/, "");

/** What <Link href> takes: an internal address ("/priser"), or one with its parameters ({ pathname: "/guider/[slug]", params: { slug } }). */
type Href = Parameters<typeof getPathname>[0]["href"];

/** The full address of a page in a language: https://kopanalys.se/priser, https://kopanalys.se/en/pricing. */
export function absoluteUrl(locale: AppLocale, href: Href): string {
  const path = getPathname({ locale, href });
  return `${SITE_URL}${path === "/" ? (locale === DEFAULT_LOCALE ? "" : path) : path}`.replace(/\/$/, "") || SITE_URL;
}

/**
 * The <link rel="alternate" hreflang> and canonical links of a page: where the same page is in each language,
 * so a search engine shows the Swedish page to Swedish readers and the English one to English readers.
 */
export function pageAlternates(
  locale: AppLocale,
  href: Href,
  { languages = LOCALE_CODES, canonical = locale }: { languages?: readonly AppLocale[]; canonical?: AppLocale } = {},
): NonNullable<Metadata["alternates"]> {
  return {
    canonical: absoluteUrl(canonical, href),
    languages: {
      ...Object.fromEntries(languages.map((code) => [LOCALES[code].htmlLang, absoluteUrl(code, href)])),
      "x-default": absoluteUrl(DEFAULT_LOCALE, href),
    },
  };
}

/**
 * The metadata of a public page in a language: its title (the site's name is added after it) and description,
 * where it is in every language (canonical and hreflang), and what a link to it looks like when it is shared.
 */
export function pageMetadata(
  locale: AppLocale,
  href: Href,
  {
    title,
    description,
    index = true,
    languages,
    canonical,
    openGraph,
  }: {
    title: string;
    description: string;
    /** false for a page that search engines should not list (for example a page that is only a Swedish text under an English address). */
    index?: boolean;
    /** The languages the page exists in, when it is not every language. */
    languages?: readonly AppLocale[];
    /** The language whose address is the page's canonical one, when it is not this one. */
    canonical?: AppLocale;
    /** Added to the page's Open Graph data (for example the type "article"). */
    openGraph?: Record<string, unknown>;
  },
): Metadata {
  return {
    title,
    description,
    alternates: pageAlternates(locale, href, { languages, canonical }),
    openGraph: { title, description, url: absoluteUrl(locale, href), locale: LOCALES[locale].ogLocale, ...openGraph } as Metadata["openGraph"],
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}
