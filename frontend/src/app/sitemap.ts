import type { MetadataRoute } from "next";
import { ROUTES } from "@/components/site/navigation";
import { ARTICLES, articleHref } from "@/lib/kunskap/articles";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://kopanalys.se").replace(/\/$/, "");

/** The public pages and every article - /sitemap.xml. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    ROUTES.home,
    ROUTES.skapaAnalys,
    ROUTES.priser,
    ROUTES.omraden,
    ROUTES.karta,
    ROUTES.prisutveckling,
    ROUTES.saFungerarDet,
    ROUTES.blogg,
    ROUTES.guider,
    ROUTES.nyheter,
    ROUTES.kontakt,
    ROUTES.integritetspolicy,
    ROUTES.villkor,
  ].map((path) => ({ url: `${SITE_URL}${path}`, priority: path === ROUTES.home ? 1 : 0.7 }));

  const articles = ARTICLES.map((article) => ({
    url: `${SITE_URL}${articleHref(article)}`,
    lastModified: article.publishedAt,
    priority: 0.6,
  }));

  return [...pages, ...articles];
}
