"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, ClipboardIcon, FileTextIcon, SearchIcon, ShieldIcon } from "@/components/icons";

/** The three steps from a home you like to a decision you can stand behind - also the top of /sa-fungerar-det. Their words are in the messages: sections.howItWorks.steps.<id> */
export const HOW_IT_WORKS_STEPS = [
  { icon: SearchIcon, id: "find" },
  { icon: ClipboardIcon, id: "analyse" },
  { icon: FileTextIcon, id: "report" },
] as const;

export function HowItWorksSteps() {
  const t = useTranslations("sections.howItWorks");
  return (
    <ol className="relative grid gap-4 md:grid-cols-3 md:gap-5">
      {/* The thread between the steps, behind the number badges */}
      <span
        aria-hidden
        className="absolute left-[16.5%] right-[16.5%] top-[52px] hidden h-px bg-gradient-to-r from-ka-green-700/0 via-ka-green-700/35 to-ka-green-700/0 md:block"
      />
      {HOW_IT_WORKS_STEPS.map(({ icon: Icon, id }, i) => (
        <Reveal key={id} variant="up" delay={i * 90} className="h-full">
          <li className="relative flex h-full flex-col items-start rounded-[22px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)] sm:p-7 md:items-center md:text-center">
            <span className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full bg-ka-green-800 text-white shadow-[0_0_0_8px_rgba(255,255,255,1)]">
              <Icon className="h-[26px] w-[26px]" />
              <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-ka-mint text-[13px] font-bold text-ka-green-950">
                {i + 1}
              </span>
            </span>
            <h3 className="mt-5 text-[19px] font-bold text-ka-ink">{t(`steps.${id}.title`)}</h3>
            <p className="mt-2 max-w-[340px] text-[15px] leading-relaxed text-ka-muted">{t(`steps.${id}.text`)}</p>
          </li>
        </Reveal>
      ))}
    </ol>
  );
}

export function HowItWorksSection() {
  const t = useTranslations("sections.howItWorks");
  const tPackages = useTranslations("packages");
  return (
    <section id="sa-fungerar-det" aria-labelledby="sa-fungerar-det-title" className="relative scroll-mt-24 bg-ka-sand">
      <div className={`${LANDING_CONTAINER} py-20 lg:py-28`}>
        <SectionIntro
          icon={ShieldIcon}
          label={t("eyebrow")}
          titleId="sa-fungerar-det-title"
          title={t("title")}
          description={t("description")}
        />

        <div className="mt-12">
          <HowItWorksSteps />
        </div>

        <Reveal variant="up" className="mt-8">
          <div className="flex flex-col gap-4 rounded-[20px] border border-ka-green-700/15 bg-ka-sage/45 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-[15px] leading-relaxed text-ka-text">
              <span className="font-semibold text-ka-green-900">{t("note")}</span> {tPackages("reviewPromise")}
            </p>
            <Link
              href={ROUTES.saFungerarDet}
              className="group inline-flex shrink-0 items-center gap-2 text-[15px] font-semibold text-ka-green-800 transition hover:text-ka-green-950"
            >
              {t("more")}
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
