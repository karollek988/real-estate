import type { Metadata } from "next";
import { Suspense } from "react";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { PublicMap } from "@/components/map/PublicMap";
import { ROUTES } from "@/components/site/navigation";

export const metadata: Metadata = {
  title: "Karta – bostäder, köpare och byten",
  description: "Utforska bostäder till salu, köpare som söker och bostadsbyten på kartan. En förhandsversion av Köpanalys karta.",
  alternates: { canonical: ROUTES.karta },
};

/**
 * The map under the site header: a slim bar that says what this is (a preview
 * with example listings), then the map workspace filling the rest of the
 * screen. The footer follows below it.
 */
export default function KartaPage() {
  return (
    <div className="flex h-[calc(100svh-64px)] min-h-[640px] flex-col lg:h-[calc(100svh-76px)] 2xl:h-[calc(100svh-84px)]">
      <div className="shrink-0 border-b border-ka-line bg-ka-cream">
        <div className={`${LANDING_CONTAINER} flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5`}>
          <h1 className="text-[17px] font-bold text-ka-ink">Karta</h1>
          <span className="rounded-full bg-ka-sage px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-ka-green-900">
            Förhandsversion
          </span>
          <p className="text-[13.5px] leading-snug text-ka-muted">
            Kartan visar exempelannonser. Annonser du lägger till sparas bara i din webbläsare.
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="h-full bg-ka-green-950" />}>
          <PublicMap />
        </Suspense>
      </div>
    </div>
  );
}
