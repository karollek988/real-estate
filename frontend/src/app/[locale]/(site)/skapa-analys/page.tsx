import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AnalyzeSection } from "@/components/landing/AnalyzeSection";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { HowItWorksSteps } from "@/components/sections/HowItWorksSection";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon } from "@/components/icons";
import { ClientMessages } from "@/i18n/ClientMessages";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";
import { PACKAGES, packageTexts } from "@/lib/packages";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "pages.createAnalysis.meta" });
  return pageMetadata(locale, ROUTES.skapaAnalys, { title: t("title"), description: t("description") });
}

/** Where every "Skapa analys" outside the landing page leads: the analysis form, how it works and what it costs. */
export default async function SkapaAnalysPage({ params }: LocaleParams) {
  await pageLocale(params);
  const t = await getTranslations("pages.createAnalysis");
  const tPackages = await getTranslations("packages");

  return (
    <>
      <ClientMessages areas={["landing", "forms"]}>
        <AnalyzeSection titleAs="h1" sectionId="skapa-analys" />
      </ClientMessages>

      <section aria-labelledby="sa-gar-det-till-title" className="border-y border-ka-line bg-ka-sand">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="sa-gar-det-till-title" className="font-display text-[30px] font-bold text-ka-ink sm:text-[38px]">
              {t("how.title")}
            </h2>
            <Link
              href={ROUTES.saFungerarDet}
              className="group inline-flex items-center gap-2 text-[15px] font-semibold text-ka-green-700 hover:text-ka-green-900"
            >
              {t("how.more")}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="mt-10">
            <ClientMessages areas={["sections"]}>
              <HowItWorksSteps />
            </ClientMessages>
          </div>
        </div>
      </section>

      <section aria-labelledby="pris-title" className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
          <div className="grid gap-6 rounded-[24px] border border-ka-line bg-white p-6 sm:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:items-center lg:gap-10">
            <div>
              <h2 id="pris-title" className="font-display text-[26px] font-bold text-ka-ink sm:text-[30px]">
                {t("cost.title")}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-ka-muted">{t("cost.text")}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {PACKAGES.map((pkg) => {
                const texts = packageTexts(tPackages, pkg);
                return (
                  <li key={pkg.key}>
                    <Link
                      href={ROUTES.priser}
                      className={`group flex h-full flex-col rounded-[18px] border p-5 transition hover:-translate-y-0.5 ${
                        pkg.highlighted ? "border-ka-green-800 bg-ka-green-950 text-white" : "border-ka-line bg-ka-cream/60 text-ka-ink hover:border-ka-green-700/30"
                      }`}
                    >
                      <span className="text-[15px] font-bold">{texts.name}</span>
                      <span className="mt-1 font-display text-[30px] font-bold leading-none">
                        {tPackages.rich("priceTag", {
                          price: pkg.price,
                          n: (chunks) => <>{chunks}</>,
                          u: (chunks) => <span className="font-sans text-[14px] font-semibold opacity-75">{chunks}</span>,
                        })}
                      </span>
                      <span className={`mt-2 text-[13.5px] leading-snug ${pkg.highlighted ? "text-white/70" : "text-ka-muted"}`}>{texts.summary}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
