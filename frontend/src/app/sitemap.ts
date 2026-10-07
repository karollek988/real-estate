import type { MetadataRoute } from "next";
import { ROUTES } from "@/components/site/navigation";
import { CONTENT_TYPES } from "@/lib/content/model";
import { contentHref, siteUrl } from "@/lib/content/paths";
import { listPublishedContent } from "@/lib/content/repository";

// Follows what the editor publishes (adminStore.ts revalidates it at once).
export const revalidate = 300;

/**
 * /sitemap.xml: the public pages and every published guide, insight and news
 * item. Bostadsguiden and Insikter are listed once they have a real item -
 * until then they are noindex (their pages) and left out here.
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
  ].map((path) => ({ url: `${SITE_URL}${path}`, priority: path === ROUTES.home ? 1 : 0.7 }));

  const items = published
    // An item whose canonical address is elsewhere is not listed as its own page.
    .filter((item) => !item.canonicalUrl || item.canonicalUrl === `${SITE_URL}${contentHref(item)}`)
    .map((item) => ({ url: `${SITE_URL}${contentHref(item)}`, lastModified: item.updatedAt, priority: 0.6 }));

  return [...pages, ...items];
}
