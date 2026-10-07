import { isCategorySlug, readingMinutesFor, type ContentInput, type ContentItem, type ContentStatus, type ContentType } from "./model";

/** A row of public.content_items as Supabase returns it. */
export interface ContentRow {
  id: string;
  type: ContentType;
  slug: string;
  title: string;
  excerpt: string;
  body?: string;
  category: string | null;
  cover_image: string | null;
  cover_image_alt: string;
  author_name: string;
  reading_minutes: number | null;
  status: ContentStatus;
  featured: boolean;
  published_at: string | null;
  updated_at: string;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  social_image: string | null;
}

/** The columns a list needs (no body: a list never shows it). */
export const LIST_COLUMNS =
  "id,type,slug,title,excerpt,category,cover_image,cover_image_alt,author_name,reading_minutes,status,featured,published_at,updated_at,seo_title,seo_description,canonical_url,social_image";

/** Everything a page shows. Never `*`: who wrote or changed an item stays in the database. */
export const PAGE_COLUMNS = `${LIST_COLUMNS},body`;

export function rowToItem(row: ContentRow): ContentItem {
  const body = row.body ?? "";
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body,
    category: isCategorySlug(row.category) ? row.category : null,
    coverImage: row.cover_image,
    coverImageAlt: row.cover_image_alt,
    authorName: row.author_name,
    readingMinutes: row.reading_minutes ?? (body ? readingMinutesFor(body) : 1),
    status: row.status,
    featured: row.featured,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    canonicalUrl: row.canonical_url,
    socialImage: row.social_image,
  };
}

/** The editor's input as table columns. */
export function inputToColumns(input: ContentInput) {
  return {
    type: input.type,
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    body: input.body,
    category: input.category,
    cover_image: input.coverImage,
    cover_image_alt: input.coverImageAlt,
    author_name: input.authorName,
    reading_minutes: input.readingMinutes,
    featured: input.featured,
    seo_title: input.seoTitle,
    seo_description: input.seoDescription,
    canonical_url: input.canonicalUrl,
    social_image: input.socialImage,
  };
}
