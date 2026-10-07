import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ArrowRightIcon, FilePlusIcon, MapFoldIcon } from "@/components/icons";
import { ROUTES } from "@/components/site/navigation";

/**
 * The closing call to action of a page: start an analysis, or look at the
 * map first. One per page, at the end, so the pages don't repeat buttons.
 */
export async function CtaBand({ title, text }: { title?: string; text?: string }) {
  const t = await getTranslations("common.cta");
  return (
    <section aria-labelledby="cta-band-title" className="bg-ka-cream py-16 lg:py-24">
      <div className={LANDING_CONTAINER}>
        <div className="relative overflow-hidden rounded-[28px] bg-ka-green-950 px-6 py-10 text-white shadow-[0_40px_80px_-40px_rgba(12,42,31,0.85)] sm:px-10 sm:py-12 lg:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-[280px] w-[620px] bg-[url('/images/header-contours.svg')] bg-[length:620px_80px] opacity-25"
          />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
            <div>
              <h2 id="cta-band-title" className="font-display text-[30px] font-bold leading-[1.1] tracking-[-0.015em] sm:text-[38px]">
                {title ?? t("title")}
              </h2>
              <p className="mt-3 max-w-[560px] text-[16px] leading-relaxed text-white/75">{text ?? t("text")}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={ROUTES.skapaAnalys}
                className="group inline-flex h-[54px] items-center justify-center gap-2.5 rounded-[12px] bg-ka-cream px-6 text-[16px] font-semibold text-ka-green-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-mint focus-visible:ring-offset-2 focus-visible:ring-offset-ka-green-950"
              >
                <FilePlusIcon className="h-5 w-5" />
                {t("createAnalysis")}
                <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href={ROUTES.karta}
                className="inline-flex h-[54px] items-center justify-center gap-2.5 rounded-[12px] border-[1.5px] border-white/30 px-6 text-[16px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-mint focus-visible:ring-offset-2 focus-visible:ring-offset-ka-green-950"
              >
                <MapFoldIcon className="h-5 w-5" />
                {t("showMap")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
