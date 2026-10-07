import type { Metadata } from "next";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { BostadsguidenHero } from "@/components/kunskap/BostadsguidenHero";
import { ContentEmptyState } from "@/components/kunskap/ContentEmptyState";
import { FeaturedGuide } from "@/components/kunskap/FeaturedGuide";
import { GuideCategoryBand } from "@/components/kunskap/GuideCategoryBand";
import { GuideCta } from "@/components/kunskap/GuideCta";
import { GuideLibrary } from "@/components/kunskap/GuideLibrary";
import { KunskapLinks } from "@/components/kunskap/KunskapLinks";
import { ROUTES } from "@/components/site/navigation";
import { handwriting } from "@/lib/fonts";
import { listPublishedContent, pickFeatured } from "@/lib/content/repository";

// Rebuilt at most every five minutes, and at once when the editor publishes (adminStore.ts).
export const revalidate = 300;

const DESCRIPTION =
  "Guider som förklarar det som påverkar ett bostadsköp: föreningens ekonomi, skuldsättning, räntekänslighet, kostnader, områden och risker.";

export async function generateMetadata(): Promise<Metadata> {
  const guides = await listPublishedContent("guide");
  return {
    title: "Bostadsguiden – förstå bostadsköpet",
    description: DESCRIPTION,
    alternates: { canonical: ROUTES.bostadsguiden },
    openGraph: {
      type: "website",
      locale: "sv_SE",
      siteName: "Köpanalys",
      url: ROUTES.bostadsguiden,
      title: "Bostadsguiden – förstå bostadsköpet",
      description: DESCRIPTION,
      images: [{ url: "/images/bostadsguiden/stockholm-strandvagen.jpg", alt: "Strandvägen i Stockholm" }],
    },
    // A hub without a single real guide is a thin page: kept out of search
    // until the first guide is published, then indexed automatically.
    robots: guides.some((guide) => !guide.isDemo) ? undefined : { index: false, follow: true },
  };
}

export default async function BostadsguidenPage() {
  const guides = await listPublishedContent("guide");
  const featured = pickFeatured(guides);

  return (
    <div className={handwriting.variable}>
      <BostadsguidenHero />
      <GuideCategoryBand />

      {featured && (
        <section aria-labelledby="featured-title" className="bg-ka-cream">
          <div className={`${LANDING_CONTAINER} pb-4 pt-12 lg:pt-16`}>
            <h2 id="featured-title" className="sr-only">
              Utvald guide
            </h2>
            <FeaturedGuide item={featured} />
          </div>
        </section>
      )}

      <div className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-12 lg:py-16`}>
          <GuideLibrary
            items={guides}
            type="guide"
            title="Alla guider"
            hideWhenUnfiltered={featured?.id}
            empty={
              <ContentEmptyState
                title="De första guiderna är på väg"
                text="Vi skriver just nu guider om föreningens ekonomi, kostnaderna runt ett köp, områden och riskerna att se upp med. Tills de är publicerade kan du följa marknaden eller se vad en analys visar."
                links={[
                  { label: "Prisutveckling", href: ROUTES.prisutveckling },
                  { label: "Se exempelrapport", href: ROUTES.exempelrapport },
                ]}
              />
            }
          />
        </div>
      </div>

      <section aria-label="Mer i Kunskap" className="bg-ka-cream">
        <div className={LANDING_CONTAINER}>
          <KunskapLinks current={ROUTES.bostadsguiden} />
        </div>
      </section>

      <GuideCta />
    </div>
  );
}
