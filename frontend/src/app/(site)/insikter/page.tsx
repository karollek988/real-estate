import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, BarChartIcon, TrendingUpIcon } from "@/components/icons";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ContentEmptyState } from "@/components/kunskap/ContentEmptyState";
import { FeaturedGuide } from "@/components/kunskap/FeaturedGuide";
import { GuideLibrary } from "@/components/kunskap/GuideLibrary";
import { KunskapLinks } from "@/components/kunskap/KunskapLinks";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { listPublishedContent, pickFeatured } from "@/lib/content/repository";

export const revalidate = 300;

const DESCRIPTION = "Insikter från bostadsmarknaden: fördjupningar byggda på data om priser, räntor, föreningar och områden.";

export async function generateMetadata(): Promise<Metadata> {
  const insights = await listPublishedContent("insight");
  return {
    title: "Insikter – data från bostadsmarknaden",
    description: DESCRIPTION,
    alternates: { canonical: ROUTES.insikter },
    // Indexed from the first published insight (see /bostadsguider).
    robots: insights.some((item) => !item.isDemo) ? undefined : { index: false, follow: true },
  };
}

export default async function InsikterPage() {
  const insights = await listPublishedContent("insight");
  const featured = pickFeatured(insights);

  return (
    <>
      <PageHero
        icon={TrendingUpIcon}
        eyebrow="Insikter"
        title="Data från bostadsmarknaden"
        lead="Fördjupningar byggda på siffror – om priser, räntor, föreningar och områden. Vad de säger, och vad de betyder för dig som ska köpa."
        crumbs={[{ label: "Kunskap" }, { label: "Insikter" }]}
        aside={
          <Link
            href={ROUTES.prisutveckling}
            className="group flex flex-col gap-5 rounded-[26px] bg-ka-green-950 p-7 text-white shadow-ka-card transition duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-ka-cream motion-reduce:hover:translate-y-0 sm:p-9"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <BarChartIcon className="h-6 w-6 text-ka-mint" />
            </span>
            <span>
              <span className="block text-[12px] font-bold uppercase tracking-[0.14em] text-ka-mint">Uppdateras löpande</span>
              <span className="mt-2 block font-display text-[26px] font-bold leading-tight sm:text-[30px]">Prisutveckling och trender</span>
              <span className="mt-2 block text-[15.5px] leading-relaxed text-white/75">
                Styrränta, bostadspriser, kvadratmeterpriser och inflation – direkt från Riksbanken, SCB och Svensk Mäklarstatistik.
              </span>
            </span>
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-ka-mint">
              Se siffrorna
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        }
      />

      {featured && (
        <section aria-labelledby="featured-title" className="bg-ka-cream">
          <div className={`${LANDING_CONTAINER} pb-4 pt-12 lg:pt-16`}>
            <h2 id="featured-title" className="sr-only">
              Utvald insikt
            </h2>
            <FeaturedGuide item={featured} label="Utvald insikt" />
          </div>
        </section>
      )}

      <div className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-12 lg:py-16`}>
          <GuideLibrary
            items={insights}
            type="insight"
            title="Alla insikter"
            hideWhenUnfiltered={featured?.id}
            showCategories={false}
            empty={
              <ContentEmptyState
                title="De första insikterna är på väg"
                text="Här samlar vi fördjupningar om vad siffrorna på bostadsmarknaden betyder. Tills dess finns de senaste siffrorna under Prisutveckling."
                links={[
                  { label: "Prisutveckling", href: ROUTES.prisutveckling },
                  { label: "Bostadsguiden", href: ROUTES.bostadsguiden },
                ]}
              />
            }
          />
        </div>
      </div>

      <section aria-label="Mer i Kunskap" className="bg-ka-cream">
        <div className={LANDING_CONTAINER}>
          <KunskapLinks current={ROUTES.insikter} />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
