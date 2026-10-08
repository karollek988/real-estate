import type { Metadata } from "next";
import { ContentRoutePage, contentMetadata, contentStaticParams } from "@/components/kunskap/contentRoute";
import { pageLocale } from "@/i18n/page";

type Params = { params: Promise<{ locale: string; slug: string }> };

// Our own published news items are built ahead; new ones render on first visit. Rebuilt
// every five minutes at most, and at once when the editor saves.
export const revalidate = 300;

export function generateStaticParams() {
  return contentStaticParams("news");
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await pageLocale(params);
  return contentMetadata("news", (await params).slug, locale);
}

export default async function NewsItemPage({ params }: Params) {
  const locale = await pageLocale(params);
  return <ContentRoutePage type="news" slug={(await params).slug} locale={locale} />;
}
