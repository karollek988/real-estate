"use client";

import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
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
    <section id="sa-fungerar-det" className="relative scroll-mt-24">
      <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20">
        <SectionIntro
          icon={ShieldIcon}
          label="Så fungerar det"
          title={<>Från &rdquo;jag hittade en bostad&rdquo; till &rdquo;jag vet vad jag köper&rdquo;</>}
          description="Vi står på köparens sida. Vi säljer inte bostaden och inte priset — vi ger dig allt som är relevant för köpet, samlat i en rapport."
        />

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text, soon }, i) => (
            <Reveal key={title} variant="up" delay={i * 80} className="h-full">
              <li className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-green-500/25 bg-green-500/10">
                    <Icon className="h-5 w-5 text-green-400" />
                  </span>
                  <span className="text-sm font-semibold text-neutral-500">{i + 1}</span>
                </div>
                <h3 className="mt-5 text-[18px] font-semibold">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-400">{text}</p>
                {soon && (
                  <span className="mt-4 w-fit rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-neutral-300">
                    Kommer snart
                  </span>
                )}
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal variant="up" className="mt-6">
          <div className="grid gap-6 rounded-2xl border border-green-500/25 bg-green-500/[0.05] p-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-green-400">Allt detta ingår i Trygghetspaketet, {TRYGGHETSPAKET_PRICE_SEK} kr</p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {INCLUDED.map(({ text, soon }) => (
                  <li key={text} className="flex items-start gap-2.5 text-[14.5px] text-neutral-200">
                    <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-400" />
                    <span>
                      {text}
                      {soon && <span className="ml-2 text-xs font-medium text-neutral-400">(lanseras snart)</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-neutral-400">
                {BRF_REVIEW_PROMISE} {AREA_ANALYSIS_PROMISE}
              </p>
            </div>
            <Link
              href="/#priser"
              className="inline-flex w-fit items-center gap-2.5 rounded-[10px] bg-green-600 px-6 py-3 text-[15px] font-semibold text-white transition hover:scale-[1.02] hover:bg-green-500 active:scale-[0.99]"
            >
              Se priserna
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
