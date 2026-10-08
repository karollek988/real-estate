import type { Metadata } from "next";
import { ContentRoutePage, contentMetadata, contentStaticParams } from "@/components/kunskap/contentRoute";
import { pageLocale } from "@/i18n/page";

type Params = { params: Promise<{ locale: string; slug: string }> };

// Published guides are built ahead; new ones render on first visit. Rebuilt
// every five minutes at most, and at once when the editor saves.
export const revalidate = 300;

export function generateStaticParams() {
  return contentStaticParams("guide");
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = await pageLocale(params);
  return contentMetadata("guide", (await params).slug, locale);
}

export default async function GuidePage({ params }: Params) {
  const locale = await pageLocale(params);
  return <ContentRoutePage type="guide" slug={(await params).slug} locale={locale} />;
}
