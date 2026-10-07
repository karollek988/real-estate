import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/Reveal";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, MapFoldIcon, MapPinIcon } from "@/components/icons";
import { AREA_TOPICS } from "@/components/sections/areaTopics";
import { OMRADESANALYS_PRICE_SEK } from "@/lib/pricing";

/**
 * The landing page's "Områden": what the area analysis shows, with the ways to
 * order one and to explore the map (/karta). The map itself is pictured in the
 * hero, so this section has no picture of its own.
 */
export function AreasSection() {
  const t = useTranslations("sections.areas");
  const tPackages = useTranslations("packages");
  return (
    <section id="omraden" aria-labelledby="omraden-title" className="relative scroll-mt-24 overflow-hidden bg-ka-sand">
      <div className={`${LANDING_CONTAINER} grid items-center gap-12 py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-28`}>
        <Reveal variant="left">
          <p className="inline-flex items-center gap-2 rounded-full bg-ka-sage/80 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
            <MapPinIcon className="h-4 w-4" />
            {t("eyebrow")}
          </p>
          <h2
            id="omraden-title"
            className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.015em] text-ka-ink sm:text-[44px]"
          >
            {t("title")}
          </h2>
          <p className="mt-4 max-w-[540px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">
            {t("lead")} {tPackages("areaPromise")}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={ROUTES.omraden}
              className="group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[12px] bg-ka-green-900 px-6 text-[15.5px] font-semibold text-white shadow-[0_14px_30px_-16px_rgba(12,42,31,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-ka-green-800"
            >
              {t("cta", { price: OMRADESANALYS_PRICE_SEK })}
              <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href={ROUTES.karta}
              className="inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[12px] border-[1.5px] border-ka-green-900/30 bg-white px-6 text-[15.5px] font-semibold text-ka-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-ka-green-900"
            >
              <MapFoldIcon className="h-5 w-5 text-ka-green-800" />
              {t("explore")}
            </Link>
          </div>
        </Reveal>

        <Reveal variant="right">
          <div className="rounded-[24px] border border-ka-line bg-white px-6 py-7 shadow-[0_24px_50px_-34px_rgba(15,31,24,0.5)] sm:px-8">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ka-green-700">{t("panelTitle")}</p>
            <ul className="mt-2 divide-y divide-ka-line">
              {AREA_TOPICS.map(({ icon: Icon, id }) => (
                <li key={id} className="flex items-start gap-4 py-4 last:pb-0">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="pt-0.5">
                    <span className="block text-[16px] font-bold text-ka-ink">{t(`topics.${id}.title`)}</span>
                    <span className="mt-0.5 block text-[14.5px] leading-relaxed text-ka-muted">{t(`topics.${id}.text`)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
