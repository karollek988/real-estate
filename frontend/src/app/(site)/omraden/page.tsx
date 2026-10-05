import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AnalyzeCard } from "@/components/landing/AnalyzeSection";
import { ScrollLink } from "@/components/landing/ScrollLink";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { AREA_TOPICS } from "@/components/sections/areaTopics";
import { FaqSection } from "@/components/sections/FaqSection";
import { PageHero, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, BarChartIcon, CheckIcon, ClockIcon, MapFoldIcon, MapPinIcon } from "@/components/icons";
import { AREA_ANALYSIS_PROMISE, PACKAGES } from "@/lib/packages";
import { OMRADESANALYS_PRICE_SEK, formatSek } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Områden – områdesanalys",
  description: `Service, skolor, pendling och trygghet runt en adress – och hur området utvecklas. Områdesanalys ${OMRADESANALYS_PRICE_SEK} kr, klar på några minuter.`,
  alternates: { canonical: ROUTES.omraden },
};

const AREA_PACKAGE = PACKAGES.find((pkg) => pkg.key === "omradesanalys");

const HOW_TO = [
  "Skriv in gatuadress och ort, till exempel Storgatan 12, Stockholm.",
  `Analysen dras från dina Områdesanalyser – ${OMRADESANALYS_PRICE_SEK} kr styck.`,
  "Rapporten om området är klar på några minuter.",
];

export default function OmradenPage() {
  return (
    <>
      <PageHero
        icon={MapPinIcon}
        eyebrow="Områden"
        title="Lär känna området innan du bestämmer dig"
        lead={`Områdesanalysen visar vad som finns runt en adress och hur området utvecklas. ${AREA_ANALYSIS_PROMISE}`}
        crumbs={[{ label: "Områden" }]}
        actions={
          <>
            <ScrollLink target="analyze" analysisMethod="area" className={PRIMARY_BUTTON}>
              Starta en områdesanalys
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </ScrollLink>
            <Link href={ROUTES.karta} className={SECONDARY_BUTTON}>
              <MapFoldIcon className="h-5 w-5 text-ka-green-800" />
              Utforska kartan
            </Link>
          </>
        }
        aside={
          AREA_PACKAGE && (
            <div className="rounded-[24px] border border-ka-line bg-white p-7 shadow-[0_24px_50px_-34px_rgba(15,31,24,0.5)]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ka-green-700">{AREA_PACKAGE.name}</p>
              <p className="mt-2 flex items-baseline gap-1.5">
                <span className="font-display text-[48px] font-bold leading-none text-ka-ink">{formatSek(AREA_PACKAGE.price)}</span>
                <span className="text-[15px] font-semibold text-ka-muted">kr · {AREA_PACKAGE.priceNote}</span>
              </p>
              <ul className="mt-5 flex flex-col gap-2.5 border-t border-ka-line pt-5">
                {AREA_PACKAGE.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[15px] text-ka-text">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ka-green-700" strokeWidth={2.4} />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href={ROUTES.priser} className="group mt-6 inline-flex items-center gap-2 text-[14.5px] font-semibold text-ka-green-700 hover:text-ka-green-900">
                Jämför med Trygghetspaketet
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          )
        }
      />

      <section aria-labelledby="innehall-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="innehall-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[38px]">
            Det här visar områdesanalysen
          </h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AREA_TOPICS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-[22px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ka-green-800 text-white">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-[18px] font-bold text-ka-ink">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ka-muted">{text}</p>
              </li>
            ))}
            <li className="flex flex-col justify-center rounded-[22px] border border-ka-green-700/20 bg-ka-sage/45 p-6">
              <ClockIcon className="h-7 w-7 text-ka-green-800" />
              <h3 className="mt-4 text-[18px] font-bold text-ka-ink">Klar på några minuter</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ka-text">
                Helt automatisk, med källan till varje uppgift angiven. Föreningens ekonomi ingår i Trygghetspaketet.
              </p>
            </li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="starta-title" className="border-y border-ka-line bg-ka-sand">
        <div className={`${LANDING_CONTAINER} grid gap-10 py-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-16 lg:py-20`}>
          <div>
            <h2 id="starta-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[38px]">
              Starta en områdesanalys
            </h2>
            <ol className="mt-8 flex flex-col gap-5">
              {HOW_TO.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-[14px] font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-1.5 text-[16px] leading-relaxed text-ka-text">{step}</p>
                </li>
              ))}
            </ol>
          </div>
          <AnalyzeCard initialMethod="area" />
        </div>
      </section>

      <section aria-label="Utforska vidare" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} grid gap-5 py-14 md:grid-cols-2 lg:py-20`}>
          <Link
            href={ROUTES.karta}
            className="group relative flex min-h-[260px] flex-col justify-end overflow-hidden rounded-[24px] bg-ka-green-950 p-7 text-white"
          >
            <Image
              src="/images/hero-laptop.png"
              alt=""
              width={1515}
              height={930}
              sizes="(min-width: 768px) 45vw, 100vw"
              className="absolute -right-10 top-4 w-[78%] max-w-[520px] opacity-90 transition-transform duration-500 group-hover:-translate-y-1"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-ka-green-950 via-ka-green-950/70 to-transparent" />
            <span className="relative">
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-ka-mint">Förhandsversion</span>
              <span className="mt-3 block font-display text-[26px] font-bold">Utforska kartan</span>
              <span className="mt-1 flex items-center gap-2 text-[15px] text-white/75">
                Bostäder, köpare och byten på kartan
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </span>
          </Link>
          <Link
            href={ROUTES.prisutveckling}
            className="group flex min-h-[260px] flex-col justify-between rounded-[24px] border border-ka-line bg-white p-7 transition hover:border-ka-green-700/30"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ka-green-800 text-white">
              <BarChartIcon className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-display text-[26px] font-bold text-ka-ink">Prisutveckling och trender</span>
              <span className="mt-1 flex items-center gap-2 text-[15px] text-ka-muted">
                Styrränta, bostadspriser och inflation i siffror
                <ArrowRightIcon className="h-4 w-4 text-ka-green-700 transition-transform group-hover:translate-x-1" />
              </span>
            </span>
          </Link>
        </div>
      </section>

      <FaqSection
        ids={["omradesanalys", "hur-lang-tid", "datakallor", "vilka-bostader", "ingen-analys-kvar"]}
        initialCount={5}
        title="Frågor om områdesanalysen"
        description="Det här undrar de flesta om områdesanalysen."
      />
    </>
  );
}
