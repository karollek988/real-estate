import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { InsightsSection } from "@/components/sections/InsightsSection";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { categoryLink } from "@/lib/content/paths";
import { ArrowRightIcon, BarChartIcon, BuildingIcon, ChartIcon, PercentIcon, TrendingUpIcon } from "@/components/icons";
import { ClientMessages } from "@/i18n/ClientMessages";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "pages.priceTrends.meta" });
  return pageMetadata(locale, ROUTES.prisutveckling, { title: t("title"), description: t("description") });
}

/** What the figures mean. The words: pages.priceTrends.meaning.<id>.title / .text */
const MEANINGS = [
  { icon: PercentIcon, id: "policyRate", link: categoryLink("guide", "brf-ekonomi") },
  { icon: TrendingUpIcon, id: "prices" },
  { icon: BuildingIcon, id: "squareMetre" },
  { icon: ChartIcon, id: "inflation" },
] as const;

export default async function PrisutvecklingPage({ params }: LocaleParams) {
  await pageLocale(params);
  const t = await getTranslations("pages.priceTrends");
  const tNav = await getTranslations("nav");

  return (
    <>
      <PageHero
        icon={BarChartIcon}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
        crumbs={[{ label: tNav("entries.bostadsanalys") }, { label: tNav("menus.bostadsanalys.prisutveckling.label") }]}
      />

      <div className="bg-ka-cream">
        <ClientMessages areas={["insights"]}>
          <InsightsSection intro={false} />
        </ClientMessages>
      </div>

      <section aria-labelledby="meaning-title" className="border-y border-ka-line bg-ka-sand">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="meaning-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[38px]">
            {t("meaning.title")}
          </h2>
          <p className="mt-3 max-w-[620px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">{t("meaning.lead")}</p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MEANINGS.map((meaning) => {
              const { icon: Icon, id } = meaning;
              return (
                <li key={id} className="flex flex-col rounded-[22px] border border-ka-line bg-white p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ka-green-800 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[17px] font-bold text-ka-ink">{t(`meaning.${id}.title`)}</h3>
                  <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-ka-muted">{t(`meaning.${id}.text`)}</p>
                  {"link" in meaning && (
                    <Link href={meaning.link} className="group mt-4 inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-ka-green-700 hover:text-ka-green-900">
                      {t("meaning.policyRate.link")}
                      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-6">
            <Link href={ROUTES.omraden} className="group inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900">
              {t("analyseArea")}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link href={ROUTES.nyheter} className="group inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900">
              {t("latestNews")}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
