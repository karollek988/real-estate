"use client";

import { Reveal } from "@/components/Reveal";
import { SectionBackground } from "@/components/SectionBackground";
import { SectionIntro } from "@/components/SectionIntro";
import {
  BuildingIcon,
  CheckIcon,
  ShieldIcon,
  TargetIcon,
  TrainIcon,
} from "@/components/icons";

const INFO_CARDS = [
  {
    icon: TargetIcon,
    title: "Analysera innan du budar",
    image: "/images/analyze-before-bid.png",
    description:
      "Budgivningar går snabbt och känslorna tar lätt över. En oberoende värdering visar vad bostaden faktiskt är värd – innan du lägger ditt första bud.",
    points: [
      "Se skillnaden mellan utgångspris och fair value",
      "Sätt din budgräns på förhand, inte i stridens hetta",
    ],
  },
  {
    icon: BuildingIcon,
    title: "Därför spelar BRF:en roll",
    image: "/images/brf-matter.png",
    description:
      "Föreningens ekonomi påverkar din månadskostnad mer än de flesta tror. Hög belåning per kvadratmeter kan betyda kraftiga avgiftshöjningar framöver.",
    points: [
      "Skuld per kvadratmeter och räntekänslighet",
      "Planerade renoveringar och avgiftsrisk",
    ],
  },
  {
    icon: TrainIcon,
    title: "Infrastruktur påverkar värdet",
    image: "/images/infrastructure.png",
    description:
      "Nya tunnelbanelinjer, pendeltågsstationer och stadsutvecklingsprojekt kan lyfta ett områdes värde långt innan de står klara.",
    points: [
      "Beslutade projekt vägs in i analysen",
      "Restid till centrum – idag och imorgon",
    ],
  },
];

export function InfoSection() {
  return (
    <section id="information" className="relative scroll-mt-24">
      <SectionBackground src="/good-to-know.png" />
      <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20">
        <SectionIntro
          icon={ShieldIcon}
          label="Bra att veta"
          title="Fatta beslut på fakta – inte magkänsla"
          description="Tre saker som avgör om en bostad är ett bra köp, och som är svåra att bedöma på egen hand."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {INFO_CARDS.map(({ icon: Icon, title, image, description, points }, i) => (
            <Reveal key={title} variant="up" delay={i * 90} className="h-full">
              <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition duration-300 hover:border-green-500/30 hover:bg-white/[0.05]">
                <div
                  className="absolute inset-0 z-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${image})` }}
                  aria-hidden="true"
                />
                <div
                  className="absolute inset-0 z-0 bg-gradient-to-b from-black/40 via-black/45 to-black/55"
                  aria-hidden="true"
                />
                <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-green-500/25 bg-green-500/10">
                  <Icon className="h-6 w-6 text-green-400" />
                </span>
                <h3 className="relative z-10 mt-5 text-[17px] font-semibold">{title}</h3>
                <p className="relative z-10 mt-3 text-[13.5px] leading-relaxed text-neutral-400">
                  {description}
                </p>
                <ul className="relative z-10 mt-5 space-y-2.5 border-t border-white/10 pt-5">
                  {points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-[13px] text-neutral-300">
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
