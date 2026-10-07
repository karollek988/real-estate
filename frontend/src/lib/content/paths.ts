import { ROUTES } from "@/components/site/navigation";
import type { ContentCategorySlug, ContentItem, ContentType } from "./model";

/** Where each type lives: guides under /bostadsguider, insights under /insikter, our own news under /nyheter. */
export const CONTENT_BASE_PATHS: Record<ContentType, string> = {
  guide: ROUTES.bostadsguiden,
  insight: ROUTES.insikter,
  news: ROUTES.nyheter,
};

/** The id of the filterable list on a hub page. */
export const LIBRARY_ANCHOR = "guider";

export function contentHref(item: Pick<ContentItem, "type" | "slug">): string {
  return `${CONTENT_BASE_PATHS[item.type]}/${item.slug}`;
}

/** A hub filtered to one category, scrolled to its list: /bostadsguider?kategori=risker#guider. */
export function categoryHref(type: ContentType, category: ContentCategorySlug): string {
  return `${CONTENT_BASE_PATHS[type]}?kategori=${category}#${LIBRARY_ANCHOR}`;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://kopanalys.se").replace(/\/$/, "");
}
