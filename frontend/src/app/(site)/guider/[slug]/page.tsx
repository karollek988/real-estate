import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage } from "@/components/kunskap/ArticlePage";
import { articleHref, articlesOfKind, findArticle } from "@/lib/kunskap/articles";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return articlesOfKind("guide").map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const article = findArticle("guide", (await params).slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: articleHref(article) },
    openGraph: { type: "article", title: article.title, description: article.excerpt, publishedTime: article.publishedAt },
  };
}

export default async function GuideArticlePage({ params }: Params) {
  const article = findArticle("guide", (await params).slug);
  if (!article) notFound();
  return <ArticlePage article={article} />;
}
