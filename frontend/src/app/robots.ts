import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://kopanalys.se").replace(/\/$/, "");

/** /robots.txt: the public pages are open; signed-in app pages and the API are not worth crawling. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/report", "/analyzing", "/admin", "/auth/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
