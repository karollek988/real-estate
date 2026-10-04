"use client";

import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ArrowRightIcon, CheckIcon, ClipboardIcon, MapPinIcon, SearchIcon, ShieldIcon, TargetIcon } from "@/components/icons";
import { AREA_ANALYSIS_PROMISE, BRF_REVIEW_PROMISE, HOUSING_COST_LIVE } from "@/lib/packages";
import { TRYGGHETSPAKET_PRICE_SEK } from "@/lib/pricing";

/** "Lösningen" from the pitch deck: Hitta → Analysera → Inspektera → Besluta. */
const STEPS = [
  { icon: MapPinIcon, title: "Hitta", text: "Bostäder på en gratis karta", soon: true },
  { icon: SearchIcon, title: "Analysera", text: "BRF, område och kostnader", soon: false },
  { icon: ClipboardIcon, title: "Inspektera", text: "Checklista till visningen", soon: false },
  { icon: TargetIcon, title: "Besluta", text: "Ett samlat underlag med allt som påverkar köpet", soon: false },
];

const INCLUDED = [
  { text: "Föreningens ekonomi i klartext — granskad av våra experter", soon: false },
  { text: "Vad bostaden kostar dig varje månad", soon: !HOUSING_COST_LIVE },
  { text: "Avgifter som är lätta att missa", soon: false },
  { text: "Området: service, skolor och resor", soon: false },
  { text: "Frågor att ställa till mäklaren", soon: false },
];

export function HowItWorksSection() {
  return (
    <section id="sa-fungerar-det" className="relative scroll-mt-24 bg-ka-cream">
      <div className={`${LANDING_CONTAINER} py-20 lg:py-28`}>
        <SectionIntro
          icon={ShieldIcon}
          label="Så fungerar det"
          title={<>Från &rdquo;jag hittade en bostad&rdquo; till &rdquo;jag vet vad jag köper&rdquo;</>}
          description="Vi står på köparens sida. Vi säljer inte bostaden och inte priset — vi ger dig allt som är relevant för köpet, samlat i en rapport."
        />

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text, soon }, i) => (
            <Reveal key={title} variant="up" delay={i * 80} className="h-full">
              <li className="flex h-full flex-col rounded-[20px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ka-green-800 text-white">
                    <Icon className="h-[22px] w-[22px]" />
                  </span>
                  <span className="font-display text-[22px] font-bold text-ka-ink/25">{i + 1}</span>
                </div>
                <h3 className="mt-5 text-[19px] font-bold text-ka-ink">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ka-muted">{text}</p>
                {soon && (
                  <span className="mt-4 w-fit rounded-full bg-ka-sage/70 px-2.5 py-0.5 text-[11.5px] font-semibold text-ka-green-900">
                    Kommer snart
                  </span>
                )}
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal variant="up" className="mt-6">
          <div className="grid gap-6 rounded-[24px] border border-ka-green-700/15 bg-[#e5e9dc] p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[15px] font-bold text-ka-green-900">
                Allt detta ingår i Trygghetspaketet, {TRYGGHETSPAKET_PRICE_SEK} kr
              </p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {INCLUDED.map(({ text, soon }) => (
                  <li key={text} className="flex items-start gap-2.5 text-[15px] text-ka-text">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                      <CheckIcon className="h-3 w-3" strokeWidth={2.6} />
                    </span>
                    <span>
                      {text}
                      {soon && <span className="ml-2 text-xs font-medium text-ka-muted">(lanseras snart)</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 max-w-2xl text-[13.5px] leading-relaxed text-ka-muted">
                {BRF_REVIEW_PROMISE} {AREA_ANALYSIS_PROMISE}
              </p>
            </div>
            <Link
              href="/#priser"
              className="group inline-flex w-fit items-center gap-2.5 rounded-[12px] bg-ka-green-900 px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_14px_30px_-16px_rgba(12,42,31,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-ka-green-800"
            >
              Se priserna
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
