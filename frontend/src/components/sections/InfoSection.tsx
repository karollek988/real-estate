"use client";

import Image from "next/image";
import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { LANDING_CONTAINER } from "@/components/landing/container";
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
    title: "Vad kostar köpet utöver priset?",
    image: "/understand-market.png",
    description:
      "Lagfart, pantbrev, föreningens avgifter och kommande avgiftshöjningar syns sällan i annonsen – men de avgör vad bostaden faktiskt kostar dig.",
    points: [
      "Din del av föreningens lån, räknat i kronor",
      "Hur avgiften påverkas om räntan stiger",
    ],
  },
  {
    icon: BuildingIcon,
    title: "Därför spelar BRF:en roll",
    image: "/images/brf-matter.png",
    description:
      "Föreningens ekonomi påverkar din månadskostnad mer än de flesta tror. Hög belåning per kvadratmeter kan betyda kraftiga avgiftshöjningar framöver.",
    points: [
      "Skuldsättning, sparande och räntekänslighet",
      "Stambyte, tomträtt och planerade avgiftshöjningar",
    ],
  },
  {
    icon: TrainIcon,
    title: "Infrastruktur påverkar området",
    image: "/images/infrastructure.png",
    description:
      "Nya tunnelbanelinjer, pendeltågsstationer och stadsutvecklingsprojekt kan förändra ett område långt innan de står klara.",
    points: [
      "Planerade projekt nära bostaden",
      "Restider till centrum med bil och kollektivtrafik",
    ],
  },
];

export function InfoSection() {
  return (
    <section id="information" className="relative scroll-mt-24 bg-ka-sand">
      <div className={`${LANDING_CONTAINER} py-20 lg:py-28`}>
        <SectionIntro
          icon={ShieldIcon}
          label="Bra att veta"
          title="Fatta beslut på fakta – inte magkänsla"
          description="Tre saker som är svåra att bedöma på egen hand, men som vi belyser med fakta och jämförelser."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {INFO_CARDS.map(({ icon: Icon, title, image, description, points }, i) => (
            <Reveal key={title} variant="up" delay={i * 90} className="h-full">
              <div className="group flex h-full flex-col overflow-hidden rounded-[22px] border border-ka-line bg-white shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_-34px_rgba(15,31,24,0.55)]">
                <div className="relative h-44 overflow-hidden">
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ka-green-950/45 to-transparent" />
                </div>
                <div className="relative flex flex-1 flex-col px-7 pb-7">
                  <span className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-ka-green-800 text-white ring-4 ring-white">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 text-[18px] font-bold text-ka-ink">{title}</h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-ka-muted">{description}</p>
                  <ul className="mt-5 space-y-2.5 border-t border-ka-line pt-5">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-[14px] text-ka-text">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ka-green-700" strokeWidth={2.4} />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
