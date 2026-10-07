import type { Metadata } from "next";
import { ContentRoutePage, contentMetadata, contentStaticParams } from "@/components/kunskap/contentRoute";

type Params = { params: Promise<{ slug: string }> };

// Published guides are built ahead; new ones render on first visit. Rebuilt
// every five minutes at most, and at once when the editor saves.
export const revalidate = 300;

export function generateStaticParams() {
  return contentStaticParams("guide");
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return contentMetadata("guide", (await params).slug);
}

export default async function GuidePage({ params }: Params) {
  return <ContentRoutePage type="guide" slug={(await params).slug} />;
}
