"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
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

/** The three cards. Their words: sections.info.cards.<id>.title / .description, and each point under sections.info.cards.<point> */
const INFO_CARDS = [
  { id: "costs", icon: TargetIcon, image: "/understand-market.png", points: ["costs.points.debt", "costs.points.rate"] },
  { id: "brf", icon: BuildingIcon, image: "/images/brf-matter.png", points: ["brf.points.debt", "brf.points.plans"] },
  { id: "infrastructure", icon: TrainIcon, image: "/images/infrastructure.png", points: ["infrastructure.points.projects", "infrastructure.points.travel"] },
] as const;

export function InfoSection() {
  const t = useTranslations("sections.info");
  return (
    <section id="information" className="relative scroll-mt-24 bg-ka-sand">
      <div className={`${LANDING_CONTAINER} py-20 lg:py-28`}>
        <SectionIntro
          icon={ShieldIcon}
          label={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {INFO_CARDS.map(({ id, icon: Icon, image, points }, i) => (
            <Reveal key={id} variant="up" delay={i * 90} className="h-full">
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
                  <h3 className="mt-4 text-[18px] font-bold text-ka-ink">{t(`cards.${id}.title`)}</h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-ka-muted">{t(`cards.${id}.description`)}</p>
                  <ul className="mt-5 space-y-2.5 border-t border-ka-line pt-5">
                    {points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-[14px] text-ka-text">
                        <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ka-green-700" strokeWidth={2.4} />
                        {t(`cards.${point}`)}
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
