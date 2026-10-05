import Image from "next/image";
import Link from "next/link";
import { ScrollLink, type AnalysisMethod } from "@/components/landing/ScrollLink";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import {
  ArrowRightIcon,
  BuildingIcon,
  CheckIcon,
  ChevronRightIcon,
  FilePlusIcon,
  MapFoldIcon,
  MapPinIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/icons";

/**
 * The landing hero: the Stockholm photo (docs/design/landing-2026-10/
 * New-Landingpage-BK.png, served as public/images/hero-stockholm.jpg) with
 * the message on the left. From lg up the photo fills the hero and a cream
 * wash (.hero-scrim) keeps the text readable while the price tags on the
 * right stay visible; on smaller screens the photo is its own framed picture
 * under the text, so it is never darkened or squeezed behind it. Four feature
 * cards close the hero. Server-rendered; the only client code is ScrollLink.
 */

const HERO_PHOTO_ALT =
  "Flygbild över Stockholm i kvällsljus med bostadspriser utmärkta i stadsdelar som Södermalm, Kungsholmen och Hammarby sjöstad";

const TRUST_POINTS = ["Oberoende analys", "Flera datakällor", "Enklare beslut", "Spara tid och pengar"];

const FEATURES: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  text: string;
  target: string;
  analysisMethod?: AnalysisMethod;
}[] = [
  {
    icon: SearchIcon,
    title: "Analysera bostäder",
    text: "Se om priset är rimligt med hjälp av data och historik.",
    target: "analyze",
    analysisMethod: "screenshot",
  },
  {
    icon: MapPinIcon,
    title: "Utforska områden",
    text: "Jämför områden, se prisutveckling och närliggande service.",
    target: "omraden",
  },
  {
    icon: BuildingIcon,
    title: "Granska föreningar",
    text: "Få insikter om BRF:ens ekonomi och möjliga risker.",
    target: "exempelrapport",
  },
  {
    icon: ShieldIcon,
    title: "Minska riskerna",
    text: "Upptäck varningssignaler och fatta tryggare beslut.",
    target: "bostadsanalys",
  },
];

export function LandingHero() {
  return (
    <section
      aria-labelledby="hero-title"
      // --hero-pad mirrors LANDING_CONTAINER's padding, --hero-text is the text column: both feed .hero-scrim
      className="relative isolate overflow-hidden bg-ka-cream [--hero-pad:32px] [--hero-text:600px] xl:[--hero-pad:48px] xl:[--hero-text:660px] 2xl:[--hero-pad:84px] 2xl:[--hero-text:740px] min-[1800px]:[--hero-text:800px]"
    >
      {/* From lg: the photo behind everything, washed on the left */}
      <div aria-hidden className="absolute inset-0 -z-10 hidden lg:block">
        <Image
          src="/images/hero-stockholm.jpg"
          alt=""
          fill
          preload
          sizes="100vw"
          quality={80}
          className="object-cover object-[60%_42%]"
        />
        <div className="hero-scrim absolute inset-0" />
      </div>

      <div className={`${LANDING_CONTAINER} flex flex-col lg:min-h-[clamp(640px,calc(100svh-76px),900px)] 2xl:min-h-[clamp(680px,calc(100svh-84px),940px)]`}>
        <div className="flex flex-1 items-center pb-10 pt-10 sm:pt-14 lg:pb-12 lg:pt-16">
          <div className="w-full max-w-[640px] lg:max-w-[var(--hero-text)]">
            <p className="animate-fade-in-up inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full bg-ka-sage/80 px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ka-green-900 sm:text-[12.5px]">
              <span>Oberoende</span>
              <span aria-hidden>·</span>
              <span>Faktabaserad</span>
              <span aria-hidden className="hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline">För en tryggare bostadsaffär</span>
            </p>

            <h1
              id="hero-title"
              className="animate-fade-in-up delay-1 mt-5 font-display text-[40px] font-bold leading-[1.04] tracking-[-0.022em] text-ka-ink sm:text-[52px] lg:leading-[1] xl:text-[58px] 2xl:text-[66px] min-[1800px]:text-[72px]"
            >
              Din oberoende partner <br className="hidden sm:block" />
              för <span className="text-ka-green-700">bostadsanalyser</span>
            </h1>

            <p className="animate-fade-in-up delay-2 mt-5 max-w-[580px] text-[17px] leading-[1.6] text-ka-text sm:text-[18px] xl:text-[19.5px]">
              Vi samlar och analyserar data från flera källor för att ge dig en tydlig bild av bostäder, områden och
              föreningar – så att du kan fatta tryggare beslut.
            </p>

            <div className="animate-fade-in-up delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <ScrollLink
                target="analyze"
                analysisMethod="screenshot"
                className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-[14px] bg-ka-green-900 px-7 text-[17px] font-semibold text-white shadow-[0_16px_32px_-16px_rgba(12,42,31,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-ka-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-ka-cream active:translate-y-0 xl:h-[60px] xl:px-8 xl:text-[18px]"
              >
                <FilePlusIcon className="h-[22px] w-[22px]" />
                Skapa analys
                <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </ScrollLink>
              <Link
                href={ROUTES.karta}
                className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-ka-green-900/40 bg-white/90 px-7 text-[17px] font-semibold text-ka-ink shadow-[0_10px_24px_-18px_rgba(15,31,24,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:border-ka-green-900 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-ka-cream active:translate-y-0 xl:h-[60px] xl:px-8 xl:text-[18px]"
              >
                <MapFoldIcon className="h-[22px] w-[22px] text-ka-green-800" />
                Visa karta
              </Link>
              <ScrollLink
                target="sa-fungerar-det"
                className="group inline-flex h-12 items-center justify-center gap-1.5 rounded-xl px-3 text-[16px] font-semibold text-ka-green-800 underline-offset-4 transition hover:text-ka-green-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 sm:justify-start xl:text-[17px]"
              >
                Så fungerar det
                <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.4} />
              </ScrollLink>
            </div>

            <ul className="animate-fade-in-up delay-4 mt-8 grid grid-cols-2 gap-x-3 gap-y-3 sm:w-fit sm:gap-x-10">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-2 text-[14px] font-medium text-ka-text sm:gap-2.5 sm:text-[15px] xl:text-[16px]">
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                    <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Below lg: the photo as a framed picture under the text */}
        <div className="animate-fade-in-up delay-3 relative mb-8 aspect-[4/3] overflow-hidden rounded-[22px] shadow-[0_30px_60px_-34px_rgba(15,31,24,0.6)] ring-1 ring-black/5 sm:aspect-[16/10] lg:hidden">
          <Image
            src="/images/hero-stockholm.jpg"
            alt={HERO_PHOTO_ALT}
            fill
            sizes="(min-width: 640px) 90vw, 100vw"
            quality={80}
            className="object-cover object-[64%_50%]"
          />
        </div>

        {/* Feature cards: one per thing Köpanalys helps with, each leading to its section */}
        <ul className="relative z-[1] grid gap-3 pb-10 sm:grid-cols-2 lg:pb-12 xl:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text, target, analysisMethod }, i) => (
            <li key={title} className="animate-fade-in-up" style={{ animationDelay: `${0.4 + i * 0.07}s` }}>
              <ScrollLink
                target={target}
                analysisMethod={analysisMethod}
                className="group flex h-full items-center gap-4 rounded-[18px] border border-white/80 bg-ka-paper/95 p-4 pr-3 shadow-[0_22px_44px_-28px_rgba(15,31,24,0.6)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-ka-green-700/25 hover:bg-white hover:shadow-[0_28px_52px_-28px_rgba(15,31,24,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white transition-colors duration-300 group-hover:bg-ka-green-900">
                  <Icon className="h-7 w-7" strokeWidth={1.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16.5px] font-bold tracking-[-0.01em] text-ka-ink">{title}</span>
                  <span className="mt-1 block text-[14px] leading-[1.5] text-ka-muted">{text}</span>
                </span>
                <ChevronRightIcon
                  className="h-5 w-5 shrink-0 text-ka-ink transition-transform duration-300 group-hover:translate-x-1"
                  strokeWidth={2.2}
                />
              </ScrollLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
