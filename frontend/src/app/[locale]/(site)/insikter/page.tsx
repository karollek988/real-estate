import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon, BarChartIcon, TrendingUpIcon } from "@/components/icons";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ContentEmptyState } from "@/components/kunskap/ContentEmptyState";
import { FeaturedGuide } from "@/components/kunskap/FeaturedGuide";
import { GuideLibrary } from "@/components/kunskap/GuideLibrary";
import { KunskapLinks } from "@/components/kunskap/KunskapLinks";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { ClientMessages } from "@/i18n/ClientMessages";
import { DEFAULT_LOCALE } from "@/i18n/locales";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";
import { listPublishedContent, pickFeatured } from "@/lib/content/repository";
import { localizeItems } from "@/lib/translate/content";

export const revalidate = 300;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "kunskap.insights.meta" });
  const insights = (await localizeItems(await listPublishedContent("insight"), locale)).filter((item) => !item.isDemo);
  // Indexed from the first published insight (see /bostadsguider), in another language once it is translated.
  const indexed = insights.length > 0 && (locale === DEFAULT_LOCALE || insights.some((item) => item.translatedFrom));
  return pageMetadata(locale, ROUTES.insikter, { title: t("title"), description: t("description"), index: indexed });
}

export default async function InsikterPage({ params }: LocaleParams) {
  const locale = await pageLocale(params);
  const t = await getTranslations("kunskap.insights");
  const tKunskap = await getTranslations("kunskap");
  const insights = await localizeItems(await listPublishedContent("insight"), locale);
  const featured = pickFeatured(insights);

  return (
    <ClientMessages areas={["kunskap"]}>
      <PageHero
        icon={TrendingUpIcon}
        eyebrow={t("hero.eyebrow")}
        title={t("hero.title")}
        lead={t("hero.lead")}
        crumbs={[{ label: tKunskap("knowledge") }, { label: tKunskap("types.insight.hub") }]}
        aside={
          <Link
            href={ROUTES.prisutveckling}
            className="group flex flex-col gap-5 rounded-[26px] bg-ka-green-950 p-7 text-white shadow-ka-card transition duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2 focus-visible:ring-offset-ka-cream motion-reduce:hover:translate-y-0 sm:p-9"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <BarChartIcon className="h-6 w-6 text-ka-mint" />
            </span>
            <span>
              <span className="block text-[12px] font-bold uppercase tracking-[0.14em] text-ka-mint">{t("aside.tag")}</span>
              <span className="mt-2 block font-display text-[26px] font-bold leading-tight sm:text-[30px]">{t("aside.title")}</span>
              <span className="mt-2 block text-[15.5px] leading-relaxed text-white/75">{t("aside.text")}</span>
            </span>
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-ka-mint">
              {t("aside.cta")}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        }
      />

      {featured && (
        <section aria-labelledby="featured-title" className="bg-ka-cream">
          <div className={`${LANDING_CONTAINER} pb-4 pt-12 lg:pt-16`}>
            <h2 id="featured-title" className="sr-only">
              {t("featuredLabel")}
            </h2>
            <FeaturedGuide item={featured} label={t("featuredLabel")} />
          </div>
        </section>
      )}

      <div className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-12 lg:py-16`}>
          <GuideLibrary
            items={insights}
            type="insight"
            title={t("libraryTitle")}
            hideWhenUnfiltered={featured?.id}
            showCategories={false}
            empty={
              <ContentEmptyState
                title={t("empty.title")}
                text={t("empty.text")}
                links={[
                  { label: t("empty.prices"), href: ROUTES.prisutveckling },
                  { label: t("empty.guides"), href: ROUTES.bostadsguiden },
                ]}
              />
            }
          />
        </div>
      </div>

      <section aria-label={tKunskap("moreInKnowledge")} className="bg-ka-cream">
        <div className={LANDING_CONTAINER}>
          <KunskapLinks current={ROUTES.insikter} />
        </div>
      </section>

      <CtaBand />
    </ClientMessages>
  );
}
