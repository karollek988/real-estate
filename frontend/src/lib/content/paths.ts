import { ROUTES } from "@/components/site/navigation";
import type { Href } from "@/i18n/navigation";
import type { ContentCategorySlug, ContentItem, ContentType } from "./model";

/** Where each type lives: guides under /bostadsguider, insights under /insikter, our own news under /nyheter. */
export const CONTENT_BASE_PATHS: Record<ContentType, string> = {
  guide: ROUTES.bostadsguiden,
  insight: ROUTES.insikter,
  news: ROUTES.nyheter,
};

/** The id of the filterable list on a hub page. */
export const LIBRARY_ANCHOR = "guider";

/** The Swedish address of an item ("/bostadsguider/brf-skuldsattning"): what the editor shows and the cache is keyed by. */
export function contentHref(item: Pick<ContentItem, "type" | "slug">): string {
  return `${CONTENT_BASE_PATHS[item.type]}/${item.slug}`;
}

/** The internal address of each type's item page; what a visitor sees in each language is set in src/i18n/pathnames.ts. */
const ITEM_PATHNAMES = {
  guide: "/bostadsguider/[slug]",
  insight: "/insikter/[slug]",
  news: "/nyheter/[slug]",
} as const;

/** An item's page as <Link href> takes it: the visitor lands on the page in the language they are reading. */
export function contentLink(item: Pick<ContentItem, "type" | "slug">): Href {
  return { pathname: ITEM_PATHNAMES[item.type], params: { slug: item.slug } };
}

/** The hub of a type, as <Link href>. */
export function hubLink(type: ContentType): Href {
  return CONTENT_BASE_PATHS[type] as Href;
}

/** A hub filtered to one category, scrolled to its list: /bostadsguider?kategori=risker#guider. */
export function categoryHref(type: ContentType, category: ContentCategorySlug): string {
  return `${CONTENT_BASE_PATHS[type]}?kategori=${category}#${LIBRARY_ANCHOR}`;
}

/** The same, as <Link href> takes it. */
export function categoryLink(type: ContentType, category: ContentCategorySlug): Href {
  return { pathname: CONTENT_BASE_PATHS[type], query: { kategori: category }, hash: LIBRARY_ANCHOR } as Href;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://kopanalys.se").replace(/\/$/, "");
}
