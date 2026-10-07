"use client";

import { useTranslations } from "next-intl";
import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { QuestionIcon } from "@/components/icons";
import { LAGFART_FEE_SEK, LAGFART_STAMP_DUTY_RATE, lagfartSek } from "@/lib/report/housingCost";

/** "Det som inte står i annonsen" — the buyer's problem, as the pitch deck puts it. Their words: sections.problem.questions.<id> */
const QUESTIONS = ["debt", "pipes", "communication", "costs"] as const;

const EXAMPLE_PRICE_SEK = 4_000_000;

export function ProblemSection() {
  const t = useTranslations("sections.problem");
  return (
    <section id="problemet" className="relative scroll-mt-24 bg-ka-sand">
      <div className={`${LANDING_CONTAINER} py-20 lg:py-28`}>
        <SectionIntro
          icon={QuestionIcon}
          label={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-[1fr_400px]">
          <ol className="grid gap-4 sm:grid-cols-2">
            {QUESTIONS.map((id, i) => (
              <Reveal key={id} variant="up" delay={i * 80} className="h-full">
                <li className="flex h-full items-start gap-4 rounded-[20px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-[16.5px] font-semibold leading-snug text-ka-ink">{t(`questions.${id}`)}</p>
                </li>
              </Reveal>
            ))}
          </ol>

          <Reveal variant="right" className="h-full">
            <div className="flex h-full flex-col justify-center rounded-[20px] bg-ka-green-950 p-8 text-white shadow-[0_30px_60px_-36px_rgba(12,42,31,0.9)]">
              <p className="font-display text-[46px] font-bold leading-none tracking-tight text-ka-mint">
                {t("lagfart.amount", { amount: lagfartSek(EXAMPLE_PRICE_SEK) })}
              </p>
              <p className="mt-4 text-[16px] leading-relaxed text-white/85">
                {t("lagfart.text", { millions: EXAMPLE_PRICE_SEK / 1_000_000 })}
              </p>
              <p className="mt-4 text-xs text-white/55">
                {t("lagfart.footnote", { rate: LAGFART_STAMP_DUTY_RATE * 100, fee: LAGFART_FEE_SEK })}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
