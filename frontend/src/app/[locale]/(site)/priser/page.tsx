import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ExampleReportSection } from "@/components/sections/ExampleReportSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { PackageComparison, PackageGrid } from "@/components/sections/PricingSection";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { CheckIcon, TagIcon } from "@/components/icons";
import { ClientMessages } from "@/i18n/ClientMessages";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";
import { PURCHASE_FAQ_IDS } from "@/lib/faq";
import { OMRADESANALYS_PRICE_SEK, TRYGGHETSPAKET_PRICE_SEK } from "@/lib/pricing";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "pages.pricing.meta" });
  return pageMetadata(locale, ROUTES.priser, {
    title: t("title"),
    description: t("description", { areaPrice: OMRADESANALYS_PRICE_SEK, packagePrice: TRYGGHETSPAKET_PRICE_SEK }),
  });
}

/** The promises under the heading. The words: pages.pricing.promises.<id> */
const PROMISES = ["oneOff", "noSubscription", "noBinding", "full"] as const;

export default async function PriserPage({ params }: LocaleParams) {
  await pageLocale(params);
  const t = await getTranslations("pages.pricing");
  const tNav = await getTranslations("nav");

  return (
    <>
      <PageHero
        icon={TagIcon}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
        crumbs={[{ label: tNav("entries.priser") }]}
        actions={
          <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-center gap-2 text-[15px] font-medium text-ka-text">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ka-green-800 text-white">
                  <CheckIcon className="h-3 w-3" strokeWidth={2.6} />
                </span>
                {t(`promises.${promise}`)}
              </li>
            ))}
          </ul>
        }
      />

      <section aria-labelledby="paket-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="paket-title" className="sr-only">
            {t("packagesHeading")}
          </h2>
          <PackageGrid />
        </div>
      </section>

      <section aria-labelledby="jamfor-title" className="border-y border-ka-line bg-ka-sand">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <h2 id="jamfor-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[38px]">
            {t("compare.title")}
          </h2>
          <p className="mt-3 max-w-[620px] text-[16px] leading-relaxed text-ka-muted sm:text-[17px]">{t("compare.lead")}</p>
          <div className="mt-10">
            <PackageComparison />
          </div>
        </div>
      </section>

      <ClientMessages areas={["sections", "packages", "faq", "exampleReport", "brf", "report"]}>
        <ExampleReportSection />

        <FaqSection
          ids={PURCHASE_FAQ_IDS}
          initialCount={PURCHASE_FAQ_IDS.length}
          title={t("faq.title")}
          description={t("faq.description")}
          sectionId="fragor-om-kopet"
          tone="cream"
        />
      </ClientMessages>

      <CtaBand />
    </>
  );
}
