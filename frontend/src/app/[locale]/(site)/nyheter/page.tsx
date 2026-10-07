import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { NewsSection } from "@/components/sections/NewsSection";
import { CtaBand } from "@/components/site/CtaBand";
import { PageHero } from "@/components/site/PageHero";
import { ROUTES } from "@/components/site/navigation";
import { ArrowRightIcon, BarChartIcon, LightbulbIcon, NewspaperIcon } from "@/components/icons";
import { ClientMessages } from "@/i18n/ClientMessages";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { pageMetadata } from "@/i18n/seo";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: "pages.news.meta" });
  return pageMetadata(locale, ROUTES.nyheter, { title: t("title"), description: t("description") });
}

/** Where to go next. The words: pages.news.next.<id> */
const NEXT_STEPS = [
  { icon: BarChartIcon, id: "prices", href: ROUTES.prisutveckling },
  { icon: LightbulbIcon, id: "guides", href: ROUTES.guider },
] as const;

export default async function NyheterPage({ params }: LocaleParams) {
  await pageLocale(params);
  const t = await getTranslations("pages.news");
  const tNav = await getTranslations("nav");

  return (
    <>
      <PageHero
        icon={NewspaperIcon}
        eyebrow={t("eyebrow")}
        title={t("title")}
        lead={t("lead")}
        crumbs={[{ label: tNav("entries.kunskap") }, { label: tNav("menus.kunskap.nyheter.label") }]}
      />
      <ClientMessages areas={["kunskap"]}>
        <NewsSection />
      </ClientMessages>
      <section aria-label={t("moreLabel")} className="bg-ka-cream">
        <div className={`${LANDING_CONTAINER} grid gap-4 md:grid-cols-2`}>
          {NEXT_STEPS.map(({ icon: Icon, id, href }) => (
            <Link
              key={id}
              href={href}
              className="group flex items-center gap-4 rounded-[22px] border border-ka-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-ka-green-700/30"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                <Icon className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold text-ka-ink">{t(`next.${id}.title`)}</span>
                <span className="mt-0.5 block text-[14.5px] text-ka-muted">{t(`next.${id}.text`)}</span>
              </span>
              <ArrowRightIcon className="h-5 w-5 text-ka-green-700 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  );
}
