import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { BostadsguidenHero } from "@/components/kunskap/BostadsguidenHero";
import { ContentEmptyState } from "@/components/kunskap/ContentEmptyState";
import { FeaturedGuide } from "@/components/kunskap/FeaturedGuide";
import { GuideCategoryBand } from "@/components/kunskap/GuideCategoryBand";
import { GuideCta } from "@/components/kunskap/GuideCta";
import { GuideLibrary } from "@/components/kunskap/GuideLibrary";
import { KunskapLinks } from "@/components/kunskap/KunskapLinks";
import { ROUTES } from "@/components/site/navigation";
import { ClientMessages } from "@/i18n/ClientMessages";
import { DEFAULT_LOCALE } from "@/i18n/locales";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";
import { handwriting } from "@/lib/fonts";
import { listPublishedContent, pickFeatured } from "@/lib/content/repository";
import { localizeItems } from "@/lib/translate/content";

// Rebuilt at most every five minutes, and at once when the editor publishes (adminStore.ts).
export const revalidate = 300;

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "kunskap.guides.meta" });
  const guides = await localizeItems(await listPublishedContent("guide"), locale);
  const real = guides.filter((guide) => !guide.isDemo);
  // A hub without a single real guide is a thin page: kept out of search until the first guide is
  // published, then indexed automatically. In another language it also waits for the translation.
  const indexed = real.length > 0 && (locale === DEFAULT_LOCALE || real.some((guide) => guide.translatedFrom));
  return pageMetadata(locale, ROUTES.bostadsguiden, {
    title: t("title"),
    description: t("description"),
    index: indexed,
    openGraph: { type: "website", images: [{ url: "/images/bostadsguiden/stockholm-strandvagen.jpg", alt: t("imageAlt") }] },
  });
}

export default async function BostadsguidenPage({ params }: LocaleParams) {
  const locale = await pageLocale(params);
  const t = await getTranslations("kunskap.guides");
  const tKunskap = await getTranslations("kunskap");
  const guides = await localizeItems(await listPublishedContent("guide"), locale);
  const featured = pickFeatured(guides);

  return (
    <ClientMessages areas={["kunskap"]}>
      <div className={handwriting.variable}>
        <BostadsguidenHero />
        <GuideCategoryBand />

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
              items={guides}
              type="guide"
              title={t("libraryTitle")}
              hideWhenUnfiltered={featured?.id}
              empty={
                <ContentEmptyState
                  title={t("empty.title")}
                  text={t("empty.text")}
                  links={[
                    { label: t("empty.prices"), href: ROUTES.prisutveckling },
                    { label: t("empty.exampleReport"), href: ROUTES.exempelrapport },
                  ]}
                />
              }
            />
          </div>
        </div>

        <section aria-label={tKunskap("moreInKnowledge")} className="bg-ka-cream">
          <div className={LANDING_CONTAINER}>
            <KunskapLinks current={ROUTES.bostadsguiden} />
          </div>
        </section>

        <GuideCta />
      </div>
    </ClientMessages>
  );
}
