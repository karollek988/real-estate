import Image from "next/image";
import { ScrollLink, type AnalysisMethod } from "@/components/landing/ScrollLink";
import {
  ArrowRightIcon,
  BuildingIcon,
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  MapFoldIcon,
  MapPinIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/icons";

/**
 * The landing hero, built after docs/design/landing-2026-10/kopanalys-new-design.png:
 * a full-bleed city photo, a soft cream field behind the centred text, the
 * map laptop floating in front of the city and four feature cards overlapping
 * its lower half. Server-rendered; the only client code is ScrollLink.
 */

/**
 * The full-bleed Stockholm photo. null shows an interim gradient: no clean
 * photo (without UI on top) exists in the project yet. Drop it into
 * public/images/ and point this at it.
 */
const HERO_PHOTO: { src: string; alt: string } | null = null;

/**
 * Where "Visa karta" leads. The public map is not live yet (only the admin
 * demo is), so for now it scrolls to "Så fungerar det", where the map is
 * listed as coming soon.
 */
const MAP_TARGET = "sa-fungerar-det";

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
    target: "analyze",
    analysisMethod: "area",
  },
  {
    icon: BuildingIcon,
    title: "Granska föreningar",
    text: "Få insikter om BRF:ens ekonomi och möjliga risker.",
    target: "example-report",
  },
  {
    icon: ShieldIcon,
    title: "Minska riskerna",
    text: "Upptäck varningssignaler och fatta tryggare beslut.",
    target: "problemet",
  },
];

/** Decorative data points over the city; illustrative values, not live prices. */
const PRICE_MARKERS = [
  { price: "5 250 000 kr", change: "+2,1%", up: true, stem: 38, delay: "0.55s", place: "left-[14.5%] top-[180px] hidden min-[1400px]:flex" },
  { price: "4 950 000 kr", change: "+6,3%", up: true, stem: 44, delay: "0.7s", place: "left-[5.5%] top-[302px] hidden xl:flex" },
  { price: "3 950 000 kr", change: "−2,4%", up: false, stem: 34, delay: "0.85s", place: "right-[14%] top-[229px] hidden min-[1400px]:flex" },
  { price: "4 390 000 kr", change: "+4,8%", up: true, stem: 48, delay: "1s", place: "right-[2.4%] top-[334px] hidden xl:flex" },
];

function HeroBackdrop() {
  return (
    <div className="absolute inset-0 -z-10">
      {HERO_PHOTO ? (
        <Image
          src={HERO_PHOTO.src}
          alt={HERO_PHOTO.alt}
          fill
          preload
          sizes="100vw"
          className="object-cover object-[50%_40%]"
        />
      ) : (
        <div aria-hidden className="hero-interim-backdrop absolute inset-0" />
      )}
    </div>
  );
}

function PriceMarkers() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {PRICE_MARKERS.map(({ price, change, up, stem, delay, place }) => (
        <div
          key={price}
          className={`animate-fade-in-up absolute flex-col items-center ${place}`}
          style={{ animationDelay: delay }}
        >
          <div
            className={`rounded-[7px] border px-4 py-[7px] text-center text-white shadow-[0_12px_26px_-12px_rgba(0,0,0,0.6)] backdrop-blur-[3px] ${
              up ? "border-[#8fd6ad]/45 bg-[#2a7854]/90" : "border-[#f3aaa4]/45 bg-[#bb3b34]/90"
            }`}
          >
            <p className="whitespace-nowrap text-[15px] font-semibold leading-tight tracking-[-0.01em] 2xl:text-[16.5px]">{price}</p>
            <p className="mt-0.5 text-[12.5px] font-medium leading-tight text-white/90 2xl:text-[13.5px]">{change}</p>
          </div>
          <span className="w-[2px] bg-white/85" style={{ height: stem }} />
          <span className="relative -mt-px flex h-3.5 w-3.5 items-center justify-center">
            <span className={`marker-pulse absolute inset-0 rounded-full ${up ? "bg-[#4ade80]" : "bg-[#f87171]"}`} />
            <span
              className={`relative h-3 w-3 rounded-full bg-white ${
                up
                  ? "shadow-[0_0_0_3px_rgba(42,120,84,0.75),0_0_16px_5px_rgba(74,222,128,0.65)]"
                  : "shadow-[0_0_0_3px_rgba(187,59,52,0.75),0_0_16px_5px_rgba(248,113,113,0.65)]"
              }`}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

export function LandingHero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-ka-cream">
      <HeroBackdrop />
      <PriceMarkers />

      <div className="relative mx-auto flex w-full max-w-[1680px] flex-col px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14 xl:min-h-[clamp(800px,calc(100svh-76px),1000px)] xl:px-12 xl:pb-0 xl:pt-[31px] short:min-h-[max(660px,calc(100svh-76px))] short:pt-5 2xl:px-[84px]">
        {/* Text: sits on the soft cream field, never on the raw photo */}
        <div className="relative isolate mx-auto flex w-full max-w-[880px] flex-col items-center text-center">
          <div
            aria-hidden
            className="hero-readability pointer-events-none absolute left-1/2 top-[-46%] -z-10 hidden h-[176%] w-[min(1100px,74vw)] -translate-x-1/2 lg:block"
          />
          <div
            aria-hidden
            className="hero-readability-mobile pointer-events-none absolute inset-x-[-20px] top-[-120px] -z-10 h-[calc(100%+190px)] sm:inset-x-[-32px] lg:hidden"
          />

          <p className="animate-fade-in-up rounded-2xl bg-ka-sage/90 px-4 py-1.5 text-[11px] font-medium uppercase leading-5 tracking-[0.04em] text-[#1b2b23] sm:rounded-full sm:px-[17px] sm:py-[6px] sm:text-[12.5px] sm:tracking-[0.035em] xl:text-[13.5px] short:text-[12.5px] 2xl:text-[14px]">
            Oberoende <span className="mx-1">·</span> Faktabaserad
            <span className="hidden sm:inline">
              {" "}
              <span className="mx-1">·</span>{" "}
            </span>
            <br className="sm:hidden" />
            För en tryggare bostadsaffär
          </p>

          <h1
            id="hero-title"
            className="animate-fade-in-up delay-1 mt-5 font-display text-[40px] font-bold leading-[1.04] tracking-[-0.022em] text-ka-ink sm:text-[54px] lg:mt-4 lg:text-[clamp(54px,4.2vw,74px)] lg:leading-[0.95] short:mt-3 short:text-[clamp(46px,3.6vw,60px)]"
          >
            Din oberoende partner <br className="hidden sm:block" />
            för <span className="text-ka-green-700">bostadsanalyser</span>
          </h1>

          <p className="animate-fade-in-up delay-2 mt-5 max-w-[740px] text-[17px] leading-[1.55] text-ka-text sm:text-[18px] lg:mt-[14px] xl:text-[20px] xl:leading-[1.45] short:mt-2.5 short:text-[17.5px] 2xl:text-[21px]">
            Vi samlar och analyserar data från flera källor för att ge dig en tydlig bild av bostäder, områden och
            föreningar – så att du kan fatta tryggare beslut.
          </p>

          <div className="animate-fade-in-up delay-3 mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-[15px] lg:mt-[18px] short:mt-4">
            <ScrollLink
              target={MAP_TARGET}
              className="group inline-flex h-14 items-center justify-center gap-3 rounded-[14px] bg-ka-green-900 px-8 text-[17px] font-semibold text-white shadow-[0_14px_30px_-16px_rgba(12,42,31,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-ka-green-800 hover:shadow-[0_18px_34px_-16px_rgba(12,42,31,0.95)] active:translate-y-0 sm:min-w-[260px] xl:h-[65px] xl:min-w-[305px] xl:text-[19px] short:h-14 short:text-[17px]"
            >
              <MapFoldIcon className="h-6 w-6 xl:h-7 xl:w-7" />
              Visa karta
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </ScrollLink>
            <ScrollLink
              target="example-report"
              className="group inline-flex h-14 items-center justify-center gap-3 rounded-[14px] border-[1.5px] border-ka-green-900/55 bg-[#f7f5ef]/95 px-8 text-[17px] font-semibold text-ka-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-ka-green-900 hover:bg-white active:translate-y-0 sm:min-w-[250px] xl:h-[65px] xl:min-w-[289px] xl:text-[19px] short:h-14 short:text-[17px]"
            >
              <FileTextIcon className="h-6 w-6 xl:h-7 xl:w-7" />
              Se exempelrapport
            </ScrollLink>
          </div>

          <ul className="animate-fade-in-up delay-4 mt-6 grid grid-cols-2 gap-x-5 gap-y-3 text-left sm:flex sm:flex-wrap sm:justify-center sm:gap-x-8 lg:mt-[15px] xl:gap-x-[32px] short:mt-3">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2.5 text-[14.5px] text-ka-text sm:text-[15px] xl:text-[16.5px] short:text-[15px]">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white xl:h-[23px] xl:w-[23px]">
                  <CheckIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Laptop with the feature cards overlapping its lower half */}
        <div className="relative mt-10 xl:mt-0 xl:min-h-[330px] xl:flex-1 short:min-h-[250px]">
          <div className="relative z-[1] -mx-3 sm:mx-auto sm:w-[86%] lg:w-[min(80%,880px)] xl:absolute xl:-top-2 xl:left-1/2 xl:mx-0 xl:w-[min(57vw,1010px)] xl:-translate-x-1/2">
            <div className="animate-fade-in-up delay-3">
              <div className="hero-float [perspective:1800px]">
                <Image
                  src="/images/hero-laptop.png"
                  alt="Köpanalys-kartan med bostäder till salu i Stockholm, visad på en laptop"
                  width={1515}
                  height={930}
                  preload
                  sizes="(min-width: 1280px) 57vw, (min-width: 640px) 86vw, 100vw"
                  className="h-auto w-full origin-bottom [transform:rotateX(9deg)] drop-shadow-[0_34px_44px_rgba(10,22,16,0.32)]"
                />
              </div>
            </div>
          </div>

          <ul className="relative z-[3] -mt-10 grid gap-3 sm:-mt-16 sm:grid-cols-2 xl:absolute xl:inset-x-0 xl:bottom-6 xl:mt-0 xl:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, text, target, analysisMethod }, i) => (
              <li key={title} className="animate-fade-in-up" style={{ animationDelay: `${0.45 + i * 0.08}s` }}>
                <ScrollLink
                  target={target}
                  analysisMethod={analysisMethod}
                  className="group flex h-full items-center gap-4 rounded-[18px] border border-white/80 bg-[#f8f5ee]/95 p-3.5 pr-3 shadow-[0_22px_44px_-26px_rgba(15,31,24,0.6)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-ka-green-700/25 hover:bg-white hover:shadow-[0_28px_52px_-26px_rgba(15,31,24,0.7)] 2xl:gap-3.5 2xl:py-4 2xl:pl-[14px] 2xl:pr-3"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white transition-colors duration-300 group-hover:bg-ka-green-900 2xl:h-[60px] 2xl:w-[60px]">
                    <Icon className="h-7 w-7 2xl:h-[30px] 2xl:w-[30px]" strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16.5px] font-bold tracking-[-0.01em] text-ka-ink 2xl:text-[18px]">{title}</span>
                    <span className="mt-1 block text-[14px] leading-[1.5] tracking-[-0.01em] text-[#3c3f3b] 2xl:text-[14.5px]">{text}</span>
                  </span>
                  <ChevronRightIcon
                    className="-ml-2.5 h-[22px] w-[22px] shrink-0 text-ka-ink transition-transform duration-300 group-hover:translate-x-1"
                    strokeWidth={2.2}
                  />
                </ScrollLink>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The laptop and photo dissolve into the page under the cards */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-48 bg-gradient-to-b from-transparent via-ka-cream/70 to-ka-cream xl:h-40"
      />
    </section>
  );
}
