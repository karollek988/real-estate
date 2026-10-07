/**
 * The content model behind Kunskap: Bostadsguiden (guides), Insikter
 * (insights) and our own Nyheter (news) share one shape, one table
 * (public.content_items, supabase/migrations/20261007120000_content_items.sql)
 * and one editor (/admin/content).
 *
 * The guides explain what matters in a home purchase - the association's
 * economy, debt, interest sensitivity, costs, areas, risks - and lead to the
 * product. They never describe how Köpanalys scores or weighs anything: no
 * thresholds, weights or engine internals belong in this content.
 *
 * Pure: no imports, so the verify script, the server and the browser can all
 * use it.
 */

export const CONTENT_TYPES = ["guide", "insight", "news"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = ["draft", "published"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** How each type is named in the interface. Where each one lives is in paths.ts. */
export const CONTENT_TYPE_LABELS: Record<ContentType, { one: string; the: string; many: string; hub: string }> = {
  guide: { one: "Guide", the: "guiden", many: "Guider", hub: "Bostadsguiden" },
  insight: { one: "Insikt", the: "insikten", many: "Insikter", hub: "Insikter" },
  news: { one: "Nyhet", the: "nyheten", many: "Nyheter", hub: "Nyheter" },
};

/**
 * The five subjects of Bostadsguiden. `slug` is stored on each item and used
 * in the filter URL (?kategori=brf-ekonomi); `tone` picks the category's
 * colour (components/kunskap/categoryStyle.ts). Add a subject here and it
 * appears in the band, the filter, the editor and the validation.
 */
export const CONTENT_CATEGORIES = [
  { slug: "kopa-bostad", label: "Köpa bostad", description: "Allt du behöver veta inför ett köp", tone: "green" },
  { slug: "brf-ekonomi", label: "BRF & ekonomi", description: "Förstå föreningens ekonomi", tone: "amber" },
  { slug: "omraden", label: "Områden", description: "Lär dig jämföra områden", tone: "sky" },
  { slug: "risker", label: "Risker", description: "Varningssignaler att se upp med", tone: "coral" },
  { slug: "kostnader", label: "Kostnader", description: "Lagfart, pantbrev och löpande utgifter", tone: "stone" },
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];
export type ContentCategorySlug = ContentCategory["slug"];
export type CategoryTone = ContentCategory["tone"];

export function findCategory(slug: string | null | undefined): ContentCategory | undefined {
  return CONTENT_CATEGORIES.find((category) => category.slug === slug);
}

export function isCategorySlug(value: unknown): value is ContentCategorySlug {
  return typeof value === "string" && CONTENT_CATEGORIES.some((category) => category.slug === value);
}

/** One guide, insight or news item as the site uses it (camelCase; the table is snake_case). */
export interface ContentItem {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  excerpt: string;
  /** Markdown - the small subset in markdown.ts. Empty in lists, which load without it. */
  body: string;
  category: ContentCategorySlug | null;
  /** A picture on the site itself ("/images/..."), see images.ts. */
  coverImage: string | null;
  coverImageAlt: string;
  authorName: string;
  /** Set by the editor, or estimated from the text (readingMinutesFor). */
  readingMinutes: number;
  status: ContentStatus;
  featured: boolean;
  /** ISO timestamps. publishedAt is null until the first publication. */
  publishedAt: string | null;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  socialImage: string | null;
  /** Temporary development content (demo.ts). Never served in production. */
  isDemo?: boolean;
}

/** What the editor can set; everything else (id, dates, who) the server decides. */
export interface ContentInput {
  type: ContentType;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: ContentCategorySlug | null;
  coverImage: string | null;
  coverImageAlt: string;
  authorName: string;
  readingMinutes: number | null;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  socialImage: string | null;
}

const WORDS_PER_MINUTE = 200;

/** Reading time from the Markdown text: about 200 words a minute, at least one minute. */
export function readingMinutesFor(markdown: string): number {
  const words = markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];

/** "7 oktober 2026", in Swedish time. */
export function formatContentDate(iso: string): string {
  const date = new Date(iso);
  const [year, month, day] = date
    .toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" })
    .split("-")
    .map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** Lowercase, a-z, 0-9 and single hyphens: "BRF & ekonomi – så funkar det" → "brf-ekonomi-sa-funkar-det". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}
