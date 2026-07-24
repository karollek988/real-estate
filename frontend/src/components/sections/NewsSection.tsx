"use client";

import { Reveal } from "@/components/Reveal";
import { SectionBackground } from "@/components/SectionBackground";
import { SectionIntro } from "@/components/SectionIntro";
import { ArrowRightIcon, CalendarIcon, NewspaperIcon } from "@/components/icons";

const NEWS_ITEMS = [
  {
    category: "Räntor",
    date: "12 juli 2026",
    title: "Riksbanken sänker styrräntan till 1,75 procent",
    description:
      "Riksbanken sänker styrräntan med 0,25 procentenheter. Beskedet väntas ge lägre boräntor och ökad aktivitet på bostadsmarknaden under hösten.",
  },
  {
    category: "Marknad",
    date: "8 juli 2026",
    title: "Bostadspriserna steg 1,2 procent i juni",
    description:
      "Priserna på bostadsrätter fortsätter uppåt för femte månaden i rad. Störst är uppgången i Stockholms innerstad och centrala Göteborg.",
  },
  {
    category: "Politik",
    date: "3 juli 2026",
    title: "Nya amorteringsregler föreslås från 2027",
    description:
      "En statlig utredning föreslår mjukare amorteringskrav för förstagångsköpare. Förslaget kan påverka hur mycket hushållen får låna.",
  },
  {
    category: "Infrastruktur",
    date: "28 juni 2026",
    title: "Tunnelbaneutbyggnaden lyfter priserna i söderort",
    description:
      "Nya stationer längs Blå linjen väntas höja bostadsvärdena med upp till åtta procent i berörda områden, visar en ny analys.",
  },
];

export function NewsSection() {
  return (
    <section id="nyheter" className="relative scroll-mt-24">
      <SectionBackground src="/understand-market.png" />
      <div className="relative mx-auto w-full max-w-[1400px] px-6 pb-20 pt-24">
        <SectionIntro
          icon={NewspaperIcon}
          label="Nyheter"
          title="Förstå marknaden först"
          description="Håll koll på räntor, priser och beslut som påverkar värdet på din nästa bostad."
          action={
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              Visa alla nyheter
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          }
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {NEWS_ITEMS.map(({ category, date, title, description }, i) => (
            <Reveal key={title} variant="up" delay={i * 90} className="h-full">
              <article className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-green-500/30 hover:bg-white/[0.05]">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                    {category}
                  </span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-500">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {date}
                  </span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold leading-snug">{title}</h3>
                <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-neutral-400">
                  {description}
                </p>
                <button
                  type="button"
                  className="mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-green-400 transition-all hover:gap-3 hover:text-green-300"
                >
                  Läs mer
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
