import type { MetadataRoute } from "next";
import { ROUTES } from "@/components/site/navigation";
import { LOCALE_CODES, LOCALES } from "@/i18n/locales";
import type { Href } from "@/i18n/navigation";
import { absoluteUrl } from "@/i18n/seo";
import { CONTENT_TYPES } from "@/lib/content/model";
import { contentHref, contentLink, siteUrl } from "@/lib/content/paths";
import { listPublishedContent } from "@/lib/content/repository";

// Follows what the editor publishes (adminStore.ts revalidates it at once).
export const revalidate = 300;

/** An address in every language, each entry saying where the same page is in the other languages (hreflang). */
function inEveryLanguage(href: Href, extra: { lastModified?: string; priority: number }): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(LOCALE_CODES.map((code) => [LOCALES[code].htmlLang, absoluteUrl(code, href)]));
  return LOCALE_CODES.map((locale) => ({ url: absoluteUrl(locale, href), alternates: { languages }, ...extra }));
}

/**
 * /sitemap.xml: the public pages and every published guide, insight and news item, each in every language.
 * Bostadsguiden and Insikter are listed once they have a real item - until then they are noindex (their pages)
 * and left out here. An article exists in every language: it is translated automatically (lib/translate).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = siteUrl();
  const [guides, insights, news] = await Promise.all(CONTENT_TYPES.map((type) => listPublishedContent(type)));
  const published = [...guides, ...insights, ...news].filter((item) => !item.isDemo);

  const pages = [
    ROUTES.home,
    ROUTES.skapaAnalys,
    ROUTES.priser,
    ROUTES.omraden,
    ROUTES.karta,
    ROUTES.prisutveckling,
    ROUTES.saFungerarDet,
    ...(guides.some((item) => !item.isDemo) ? [ROUTES.bostadsguiden] : []),
    ...(insights.some((item) => !item.isDemo) ? [ROUTES.insikter] : []),
    ROUTES.nyheter,
    ROUTES.kontakt,
    ROUTES.integritetspolicy,
    ROUTES.villkor,
  ].flatMap((href) => inEveryLanguage(href as Href, { priority: href === ROUTES.home ? 1 : 0.7 }));

  const items = published
    // An item whose canonical address is elsewhere is not listed as its own page.
    .filter((item) => !item.canonicalUrl || item.canonicalUrl === `${SITE_URL}${contentHref(item)}`)
    .flatMap((item) => inEveryLanguage(contentLink(item), { lastModified: item.updatedAt, priority: 0.6 }));

  return [...pages, ...items];
}
