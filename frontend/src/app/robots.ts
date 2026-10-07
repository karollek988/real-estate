import type { MetadataRoute } from "next";
import { LOCALE_CODES } from "@/i18n/locales";
import { getPathname } from "@/i18n/navigation";
import { SITE_URL } from "@/i18n/seo";

/** The signed-in app's pages, by their internal addresses: they are worth crawling in no language. */
const PRIVATE_PAGES = ["/dashboard", "/report", "/analyzing", "/auth/confirmed"] as const;

/** /robots.txt: the public pages are open; signed-in app pages and the API are not worth crawling. */
export default function robots(): MetadataRoute.Robots {
  const privatePaths = LOCALE_CODES.flatMap((locale) => PRIVATE_PAGES.map((href) => getPathname({ locale, href })));
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/auth/", ...new Set(privatePaths)] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
