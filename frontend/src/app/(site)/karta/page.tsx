import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicMap } from "@/components/map/PublicMap";
import { ROUTES } from "@/components/site/navigation";

export const metadata: Metadata = {
  title: "Karta – bostäder, köpare och byten",
  description: "Utforska bostäder till salu, köpare som söker och bostadsbyten på kartan. En förhandsversion av Köpanalys karta.",
  alternates: { canonical: ROUTES.karta },
};

/**
 * The map filling the screen under the site header; the footer follows below
 * it. That this is a preview with example listings is said in the map's top
 * bar, next to the search (components/admin/atlas/atlas.ts), which only exists
 * once the map has mounted - so the page's h1 is here, in the server-rendered
 * HTML, and the top bar shows the same word as a plain label.
 */
export default function KartaPage() {
  return (
    <div className="h-[calc(100svh-64px)] min-h-[640px] lg:h-[calc(100svh-76px)] 2xl:h-[calc(100svh-84px)]">
      <h1 className="sr-only">Karta</h1>
      <Suspense fallback={<div className="h-full bg-ka-cream" />}>
        <PublicMap />
      </Suspense>
    </div>
  );
}
