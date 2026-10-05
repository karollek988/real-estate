import type { Metadata } from "next";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ExampleReportSection } from "@/components/sections/ExampleReportSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { PackageComparison, PackageGrid } from "@/components/sections/PricingSection";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { CheckIcon, TagIcon } from "@/components/icons";
import { PURCHASE_FAQ_IDS } from "@/lib/faq";
import { OMRADESANALYS_PRICE_SEK, TRYGGHETSPAKET_PRICE_SEK } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Priser",
  description: `Områdesanalys ${OMRADESANALYS_PRICE_SEK} kr, Trygghetspaketet ${TRYGGHETSPAKET_PRICE_SEK} kr per bostad. Engångspriser inklusive moms – inga abonnemang och ingen bindningstid.`,
  alternates: { canonical: ROUTES.priser },
};

const PROMISES = ["Engångspris inklusive moms", "Inga abonnemang", "Ingen bindningstid", "Hela rapporten – inga låsta delar"];

export default function PriserPage() {
  return (
    <>
      <PageHero
        icon={TagIcon}
        eyebrow="Priser"
        title="Du betalar en gång per bostad"
        lead="Välj vad du vill veta: området runt en adress, eller hela bilden av bostaden du vill köpa – föreningens ekonomi, området och kostnaderna."
        crumbs={[{ label: "Priser" }]}
        actions={
          <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-center gap-2 text-[15px] font-medium text-ka-text">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ka-green-800 text-white">
                  <CheckIcon className="h-3 w-3" strokeWidth={2.6} />
                </span>
                {promise}
              </li>
            ))}
          </ul>
        }
      />

      <section aria-labelledby="paket-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="paket-title" className="sr-only">
            Paket
          </h2>
          <PackageGrid />
        </div>
      </section>

      <section aria-labelledby="jamfor-title" className="border-y border-ka-line bg-ka-sand">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="jamfor-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[38px]">
            Jämför vad som ingår
          </h2>
          <p className="mt-3 max-w-[620px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">
            Den som köper en hel analys får alltid hela rapporten. Områdesanalysen är en egen, kortare rapport om området runt en adress.
          </p>
          <div className="mt-10">
            <PackageComparison />
          </div>
        </div>
      </section>

      <ExampleReportSection />

      <FaqSection
        ids={PURCHASE_FAQ_IDS}
        initialCount={PURCHASE_FAQ_IDS.length}
        title="Frågor om köpet"
        description="Betalning, vad som ingår och vad som händer om en analys inte går att slutföra."
        sectionId="fragor-om-kopet"
        tone="cream"
      />

      <CtaBand />
    </>
  );
}
