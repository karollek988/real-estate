import type { Metadata } from "next";
import Link from "next/link";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { InsightsSection } from "@/components/sections/InsightsSection";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, BarChartIcon, BuildingIcon, ChartIcon, PercentIcon, TrendingUpIcon } from "@/components/icons";
import { categoryHref } from "@/lib/content/paths";

export const metadata: Metadata = {
  title: "Prisutveckling och trender på bostadsmarknaden",
  description: "Styrränta, bostadspriser, kvadratmeterpriser och inflation – hämtade direkt från Riksbanken, SCB och Svensk Mäklarstatistik.",
  alternates: { canonical: ROUTES.prisutveckling },
};

const MEANINGS = [
  {
    icon: PercentIcon,
    title: "Styrräntan",
    text: "Riksbankens styrränta påverkar bankernas räntor – både på ditt bolån och på föreningens lån. Därför är föreningens räntekänslighet värd att känna till.",
    link: { label: "Guider om BRF & ekonomi", href: categoryHref("guide", "brf-ekonomi") },
  },
  {
    icon: TrendingUpIcon,
    title: "Bostadspriserna",
    text: "Prisindex visar hur priserna har utvecklats i stort. Det säger inget om en enskild bostad, men ger en bild av marknaden du köper i.",
  },
  {
    icon: BuildingIcon,
    title: "Kvadratmeterpriset",
    text: "Ett genomsnittligt kvadratmeterpris är en riktpunkt. Vad en enskild bostad kostar beror på läge, skick och förening.",
  },
  {
    icon: ChartIcon,
    title: "Inflationen",
    text: "Inflationen påverkar räntan och föreningens kostnader för till exempel energi och underhåll – och därmed avgiften.",
  },
];

export default function PrisutvecklingPage() {
  return (
    <>
      <PageHero
        icon={BarChartIcon}
        eyebrow="Prisutveckling"
        title="Prisutveckling och trender"
        lead="Styrräntan, bostadspriserna, kvadratmeterpriserna och inflationen – siffrorna som styr bostadsmarknaden, hämtade direkt från Riksbanken, SCB och Svensk Mäklarstatistik."
        crumbs={[{ label: "Bostadsanalys" }, { label: "Prisutveckling" }]}
      />

      <div className="bg-ka-cream">
        <InsightsSection intro={false} />
      </div>

      <section aria-labelledby="meaning-title" className="border-y border-ka-line bg-ka-sand">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="meaning-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[38px]">
            Vad betyder siffrorna för dig?
          </h2>
          <p className="mt-3 max-w-[620px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">
            Marknadens siffror förklarar läget, men det är bostaden och föreningen som avgör vad just ditt köp kostar.
          </p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MEANINGS.map(({ icon: Icon, title, text, link }) => (
              <li key={title} className="flex flex-col rounded-[22px] border border-ka-line bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ka-green-800 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[17px] font-bold text-ka-ink">{title}</h3>
                <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-ka-muted">{text}</p>
                {link && (
                  <Link href={link.href} className="group mt-4 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-ka-green-700 hover:text-ka-green-900">
                    {link.label}
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Link href={ROUTES.omraden} className="group inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900">
              Analysera ett område
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href={ROUTES.nyheter} className="group inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900">
              Senaste nyheterna om marknaden
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
