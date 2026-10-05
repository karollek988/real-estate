import Image from "next/image";
import Link from "next/link";
import { ScrollLink, type AnalysisMethod } from "@/components/landing/ScrollLink";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import {
  ArrowRightIcon,
  BuildingIcon,
  ChevronRightIcon,
  FileTextIcon,
  MapFoldIcon,
  MapPinIcon,
  SearchIcon,
  ShieldIcon,
} from "@/components/icons";

/**
 * The landing hero, built after docs/design/landing-2026-10/kopanalys-new-design.png:
 * everything on the centre line - badge, headline, text and the two buttons -
 * then the map laptop floating in front of the Stockholm photo, with the four
 * feature cards over its lower half. The photo
 * (New-Landingpage-BK.png, served as public/images/hero-stockholm.jpg) starts
 * behind the laptop with its sky melting into the cream above, so the price
 * tags printed on it sit around the laptop, never behind the text (CityPhoto).
 * Server-rendered; the only client code is ScrollLink.
 */

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

const BUTTON_BASE =
  "group inline-flex h-14 items-center justify-center gap-3 rounded-[14px] px-8 text-[17px] font-semibold transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-ka-cream active:translate-y-0 xl:h-[65px] xl:text-[19px] short:h-14 short:text-[17px]";

/**
 * The Stockholm photo around the laptop - decoration, so no alt text. The
 * picture has price tags printed on it; .hero-city-stacked and .hero-city-wide
 * (globals.scss) place it so every tag is either in full view or fully behind
 * the laptop or a feature card, never cut through by an edge.
 */
function CityPhoto({ className, sizes, loading }: { className: string; sizes: string; loading: "eager" | "lazy" }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute left-1/2 -z-10 -translate-x-1/2 ${className}`}>
      <Image src="/images/hero-stockholm.jpg" alt="" fill sizes={sizes} loading={loading} quality={80} className="object-cover object-top" />
    </div>
  );
}

export function LandingHero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-ka-cream">
      <div
        className={`${LANDING_CONTAINER} flex flex-col pb-12 pt-10 sm:pb-16 sm:pt-14 xl:min-h-[clamp(800px,calc(100svh-76px),1000px)] xl:pb-0 xl:pt-[31px] 2xl:min-h-[clamp(800px,calc(100svh-84px),1000px)] short:min-h-[max(660px,calc(100svh-76px))] short:pt-5`}
      >
        <div className="mx-auto flex w-full max-w-[880px] flex-col items-center text-center">
          <p className="animate-fade-in-up rounded-2xl bg-ka-sage/90 px-4 py-1.5 text-[11px] font-medium uppercase leading-5 tracking-[0.04em] text-ka-ink sm:rounded-full sm:px-[17px] sm:py-[6px] sm:text-[12.5px] sm:tracking-[0.035em] xl:text-[13.5px] short:text-[12.5px] 2xl:text-[14px]">
            Oberoende{" "}
            <span aria-hidden className="mx-1">
              ·
            </span>{" "}
            Faktabaserad
            <span className="hidden sm:inline">
              {" "}
              <span aria-hidden className="mx-1">
                ·
              </span>{" "}
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
            <Link
              href={ROUTES.karta}
              className={`${BUTTON_BASE} bg-ka-green-900 text-white shadow-[0_14px_30px_-16px_rgba(12,42,31,0.9)] hover:bg-ka-green-800 hover:shadow-[0_18px_34px_-16px_rgba(12,42,31,0.95)] sm:min-w-[260px] xl:min-w-[305px]`}
            >
              <MapFoldIcon className="h-6 w-6 xl:h-7 xl:w-7" />
              Visa karta
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <ScrollLink
              target="exempelrapport"
              className={`${BUTTON_BASE} border-[1.5px] border-ka-green-900/55 bg-ka-paper/95 text-ka-ink hover:border-ka-green-900 hover:bg-white sm:min-w-[250px] xl:min-w-[289px]`}
            >
              <FileTextIcon className="h-6 w-6 xl:h-7 xl:w-7" />
              Se exempelrapport
            </ScrollLink>
          </div>
        </div>

        {/* The laptop in front of the city, the feature cards over its lower half */}
        <div className="relative mt-10 xl:mt-7 xl:min-h-[330px] xl:flex-1 xl:[--hero-card-h:122px] short:min-h-[250px] 2xl:[--hero-card-h:130px] min-[1700px]:[--hero-card-h:109px]">
          {/* From xl: the photo behind the laptop area, placed against the cards */}
          <CityPhoto className="hero-city-wide hidden xl:block" sizes="(min-width: 1280px) 112vw, 1px" loading="eager" />

          <div className="relative -mx-3 sm:mx-auto sm:w-[86%] lg:w-[min(80%,880px)] xl:absolute xl:-top-2 xl:left-1/2 xl:mx-0 xl:w-[min(57vw,1010px)] xl:-translate-x-1/2">
            {/* Below xl: the photo around the laptop, ending where the cards (overlapping it by 40/64px) begin */}
            <CityPhoto className="hero-city-stacked bottom-10 sm:bottom-16 xl:hidden" sizes="(min-width: 858px) 112vw, 960px" loading="lazy" />
            <div className="animate-fade-in-up delay-3">
              <div className="hero-float [perspective:1800px]">
                <Image
                  src="/images/hero-laptop.png"
                  alt="Köpanalys-kartan med bostäder till salu i Stockholm, visad på en laptop"
                  width={1515}
                  height={930}
                  preload
                  sizes="(min-width: 1772px) 1010px, (min-width: 1280px) 57vw, (min-width: 640px) 86vw, 100vw"
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
                  className="group flex h-full items-center gap-4 rounded-[18px] border border-white/80 bg-ka-paper/95 p-3.5 pr-3 shadow-[0_22px_44px_-26px_rgba(15,31,24,0.6)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-ka-green-700/25 hover:bg-white hover:shadow-[0_28px_52px_-26px_rgba(15,31,24,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 xl:min-h-[var(--hero-card-h)] 2xl:gap-3.5 2xl:py-4 2xl:pl-[14px] 2xl:pr-3"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white transition-colors duration-300 group-hover:bg-ka-green-900 2xl:h-[60px] 2xl:w-[60px]">
                    <Icon className="h-7 w-7 2xl:h-[30px] 2xl:w-[30px]" strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16.5px] font-bold tracking-[-0.01em] text-ka-ink 2xl:text-[18px]">{title}</span>
                    <span className="mt-1 block text-[14px] leading-[1.5] tracking-[-0.01em] text-ka-text/85 2xl:text-[14.5px]">
                      {text}
                    </span>
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
