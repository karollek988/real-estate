import Image from "next/image";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ROUTES } from "@/components/site/navigation";
import { getPathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/locales";
import { GuideSearch } from "./GuideSearch";
import { HandNote } from "./HandNote";

/**
 * The top of /bostadsguider: what the page is for, a search field, and a
 * Stockholm photo in a soft organic frame with a handwritten note - after
 * the Bostadsguiden design mockup (not kept in the repo), as direction rather
 * than pixels. Stacks on phones: text, search, then a shorter photo.
 * The words: kunskap.guides.hero
 */
export function BostadsguidenHero() {
  const t = useTranslations("kunskap");
  const locale = useLocale() as AppLocale;
  return (
    <section aria-labelledby="bostadsguiden-title" className="relative overflow-hidden bg-ka-cream">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-0 hidden h-[140px] w-[1000px] bg-[url('/images/header-contours.svg')] bg-[length:1000px_125px] bg-no-repeat opacity-40 lg:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 bottom-6 hidden h-[110px] w-[880px] bg-[url('/images/header-contours.svg')] bg-[length:880px_110px] bg-no-repeat opacity-30 lg:block"
      />
      <div
        className={`${LANDING_CONTAINER} relative grid gap-9 pb-10 pt-7 sm:pt-9 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-12 lg:pb-14 xl:gap-20`}
      >
        <div className="max-w-[720px]">
          <Breadcrumbs crumbs={[{ label: t("knowledge") }, { label: t("types.guide.hub") }]} />
          <p className="mt-8 text-[12.5px] font-bold uppercase tracking-[0.16em] text-ka-green-700 sm:mt-10">{t("guides.hero.eyebrow")}</p>
          <h1
            id="bostadsguiden-title"
            className="mt-4 font-display text-[40px] font-bold leading-[1.02] tracking-[-0.025em] text-ka-ink sm:text-[54px] lg:text-[52px] xl:text-[68px]"
          >
            {t("guides.hero.title")}
          </h1>
          <p className="mt-5 max-w-[600px] text-[17px] leading-[1.6] text-ka-muted sm:text-[18.5px]">{t("guides.hero.lead")}</p>
          <div className="mt-8 max-w-[620px]">
            <GuideSearch
              type="guide"
              action={getPathname({ locale, href: ROUTES.bostadsguiden })}
              label={t("guides.hero.searchLabel")}
              placeholder={t("guides.hero.searchPlaceholder")}
            />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[560px] lg:mr-0 lg:max-w-[640px]">
          <div className="guide-blob relative aspect-[16/11] overflow-hidden bg-ka-sand shadow-ka-card sm:aspect-[1.12] lg:aspect-[1.02]">
            <Image
              src="/images/bostadsguiden/stockholm-strandvagen.jpg"
              alt={t("guides.hero.imageAlt")}
              fill
              priority
              sizes="(min-width: 1024px) 46vw, (min-width: 640px) 640px, 100vw"
              className="object-cover object-[50%_60%]"
            />
          </div>
          <div className="absolute -bottom-4 right-1 hidden w-[190px] rotate-[-3deg] rounded-[20px] bg-ka-sage/95 p-4 pb-2 shadow-ka-card ring-1 ring-ka-green-900/10 sm:block lg:-left-10 lg:bottom-10 lg:right-auto xl:-left-14">
            <HandNote>{t("guides.hero.handNote")}</HandNote>
          </div>
        </div>
      </div>
    </section>
  );
}
