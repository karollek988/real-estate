import type { Metadata } from "next";
import Link from "next/link";
import { AnalyzeSection } from "@/components/landing/AnalyzeSection";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { HowItWorksSteps } from "@/components/sections/HowItWorksSection";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon } from "@/components/icons";
import { PACKAGES } from "@/lib/packages";
import { formatSek } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Skapa analys",
  description:
    "Ladda upp en skärmdump av bostadsannonsen, fyll i uppgifterna själv eller ange en adress för en områdesanalys – så tar vi fram underlaget.",
  alternates: { canonical: ROUTES.skapaAnalys },
};

/** Where every "Skapa analys" outside the landing page leads: the analysis form, how it works and what it costs. */
export default function SkapaAnalysPage() {
  return (
    <>
      <AnalyzeSection titleAs="h1" sectionId="skapa-analys" />

      <section aria-labelledby="sa-gar-det-till-title" className="border-y border-ka-line bg-ka-sand">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="sa-gar-det-till-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[38px]">
              Så går det till
            </h2>
            <Link
              href={ROUTES.saFungerarDet}
              className="group inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900"
            >
              Läs mer om hur det fungerar
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="mt-10">
            <HowItWorksSteps />
          </div>
        </div>
      </section>

      <section aria-labelledby="pris-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <div className="grid gap-6 rounded-[24px] border border-ka-line bg-white p-6 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:items-center lg:gap-10">
            <div>
              <h2 id="pris-title" className="font-display text-[26px] font-bold text-ka-ink sm:text-[30px]">
                Vad kostar det?
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ka-muted">
                Analysen dras från ditt saldo. Har du inget kvar köper du ett paket – en gång per bostad.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {PACKAGES.map((pkg) => (
                <li key={pkg.key}>
                  <Link
                    href={ROUTES.priser}
                    className={`group flex h-full flex-col rounded-[18px] border p-5 transition hover:-translate-y-0.5 ${
                      pkg.highlighted ? "border-ka-green-800 bg-ka-green-950 text-white" : "border-ka-line bg-ka-cream/60 text-ka-ink hover:border-ka-green-700/30"
                    }`}
                  >
                    <span className="text-[15px] font-bold">{pkg.name}</span>
                    <span className="mt-1 font-display text-[30px] font-bold leading-none">
                      {formatSek(pkg.price)} <span className="font-sans text-[14px] font-semibold opacity-75">kr</span>
                    </span>
                    <span className={`mt-2 text-[13.5px] leading-snug ${pkg.highlighted ? "text-white/70" : "text-ka-muted"}`}>{pkg.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
