import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locales";
import { pageMetadata } from "@/i18n/seo";
import type { ContentType } from "@/lib/content/model";
import { contentLink } from "@/lib/content/paths";
import { getPublishedContent, listPublishedContent, relatedContent } from "@/lib/content/repository";
import { localizeItem, localizeItems } from "@/lib/translate/content";
import { ContentArticle } from "./ContentArticle";

/**
 * What the three item routes share (/bostadsguider/[slug], /insikter/[slug],
 * /nyheter/[slug]): each route file only names its type. The articles are written in
 * Swedish; in another language they are translated automatically (lib/translate/content.ts)
 * the first time they are asked for and stored.
 */

export async function contentStaticParams(type: ContentType): Promise<{ slug: string }[]> {
  const items = await listPublishedContent(type);
  return items.filter((item) => !item.isDemo).map(({ slug }) => ({ slug }));
}

export async function contentMetadata(type: ContentType, slug: string, locale: AppLocale): Promise<Metadata> {
  const original = await getPublishedContent(type, slug);
  if (!original) return {};
  const item = await localizeItem(original, locale);
  const title = item.seoTitle ?? item.title;
  const description = item.seoDescription ?? item.excerpt;
  const image = item.socialImage ?? item.coverImage;
  const images = image ? [{ url: image, alt: item.coverImageAlt }] : undefined;
  // A language is offered to search engines once the article exists in it; until then it is the Swedish text under another address.
  const indexable = !item.isDemo && (locale === DEFAULT_LOCALE || Boolean(item.translatedFrom));
  const base = pageMetadata(locale, contentLink(item), {
    title,
    description,
    index: indexable,
    openGraph: {
      type: "article",
      publishedTime: item.publishedAt ?? undefined,
      modifiedTime: item.updatedAt,
      authors: [item.authorName],
      section: item.category ?? undefined,
      images,
    },
  });
  return {
    ...base,
    // an editor's own canonical address belongs to the Swedish original only
    alternates: locale === DEFAULT_LOCALE && item.canonicalUrl ? { ...base.alternates, canonical: item.canonicalUrl } : base.alternates,
    // Demo items are scaffolding: never indexed, even on a Preview deployment.
    robots: item.isDemo ? { index: false, follow: false } : base.robots,
    authors: [{ name: item.authorName }],
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images },
  };
}

export async function ContentRoutePage({ type, slug, locale }: { type: ContentType; slug: string; locale: AppLocale }) {
  const original = await getPublishedContent(type, slug);
  if (!original) notFound();
  const all = await listPublishedContent(type);
  const [item, related] = await Promise.all([localizeItem(original, locale), localizeItems(relatedContent(original, all), locale)]);
  return <ContentArticle item={item} related={related} />;
}
