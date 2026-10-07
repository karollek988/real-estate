import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findCategory, type ContentType } from "@/lib/content/model";
import { contentHref } from "@/lib/content/paths";
import { getPublishedContent, listPublishedContent, relatedContent } from "@/lib/content/repository";
import { ContentArticle } from "./ContentArticle";

/**
 * What the three item routes share (/bostadsguider/[slug], /insikter/[slug],
 * /nyheter/[slug]): each route file only names its type.
 */

export async function contentStaticParams(type: ContentType): Promise<{ slug: string }[]> {
  const items = await listPublishedContent(type);
  return items.filter((item) => !item.isDemo).map(({ slug }) => ({ slug }));
}

export async function contentMetadata(type: ContentType, slug: string): Promise<Metadata> {
  const item = await getPublishedContent(type, slug);
  if (!item) return {};
  const title = item.seoTitle ?? item.title;
  const description = item.seoDescription ?? item.excerpt;
  const image = item.socialImage ?? item.coverImage;
  const images = image ? [{ url: image, alt: item.coverImageAlt }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: item.canonicalUrl ?? contentHref(item) },
    // Demo items are scaffolding: never indexed, even on a Preview deployment.
    robots: item.isDemo ? { index: false, follow: false } : undefined,
    authors: [{ name: item.authorName }],
    openGraph: {
      type: "article",
      locale: "sv_SE",
      siteName: "Köpanalys",
      url: contentHref(item),
      title,
      description,
      publishedTime: item.publishedAt ?? undefined,
      modifiedTime: item.updatedAt,
      authors: [item.authorName],
      section: findCategory(item.category)?.label,
      images,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images },
  };
}

export async function ContentRoutePage({ type, slug }: { type: ContentType; slug: string }) {
  const item = await getPublishedContent(type, slug);
  if (!item) notFound();
  const all = await listPublishedContent(type);
  return <ContentArticle item={item} related={relatedContent(item, all)} />;
}
