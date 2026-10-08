import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronRightIcon } from "@/components/icons";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { CONTENT_CATEGORIES, type ContentType } from "@/lib/content/model";
import { categoryLink } from "@/lib/content/paths";
import { CATEGORY_ICONS, TONE_CLASSES } from "./categoryStyle";

/**
 * "Utforska guider inom": the five subjects on a deep green band with soft,
 * wavy edges. Each subject is a tile that filters the list below
 * (?kategori=...#guider). Phones get a tappable list, tablets two columns,
 * desktops one row of five beside the heading. The words: kunskap.guides.band, kunskap.categories
 */
export function GuideCategoryBand({ type = "guide" }: { type?: ContentType }) {
  const t = useTranslations("kunskap");
  return (
    <section aria-labelledby="kategorier-title" className="relative">
      <Wave className="block h-6 w-full sm:h-10" />
      <div className="relative overflow-hidden bg-ka-green-950">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 h-[120px] w-[900px] bg-[url('/images/header-contours.svg')] bg-[length:900px_112px] bg-no-repeat opacity-[0.16]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 top-2 hidden h-[120px] w-[900px] bg-[url('/images/header-contours.svg')] bg-[length:900px_112px] bg-no-repeat opacity-[0.12] lg:block"
        />
        <div className={`${LANDING_CONTAINER} relative grid gap-6 py-9 sm:gap-8 sm:py-11 xl:grid-cols-[210px_minmax(0,1fr)] xl:items-center xl:gap-10`}>
          <h2 id="kategorier-title" className="font-display text-[27px] font-bold leading-[1.1] tracking-[-0.01em] text-white sm:text-[32px]">
            {t("guides.band.title")}
          </h2>
          <ul className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
            {CONTENT_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICONS[category.slug];
              return (
                <li key={category.slug} className="sm:last:col-span-2 lg:last:col-span-1">
                  <Link
                    href={categoryLink(type, category.slug)}
                    className="group flex h-full items-center gap-4 rounded-[18px] border border-white/12 bg-white/[0.05] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-ka-mint/45 hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-mint focus-visible:ring-offset-2 focus-visible:ring-offset-ka-green-950 motion-reduce:hover:translate-y-0 lg:flex-col lg:items-start lg:gap-3 lg:p-5"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.08] ring-1 ring-white/10">
                      <Icon className={`h-7 w-7 ${TONE_CLASSES[category.tone].onDark}`} strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-[16.5px] font-bold text-white">
                        {t(`categories.${category.slug}.label`)}
                        <ChevronRightIcon className="hidden h-4 w-4 text-white/60 transition-transform duration-200 group-hover:translate-x-0.5 lg:block" strokeWidth={2.2} />
                      </span>
                      <span className="mt-0.5 block text-[14px] leading-snug text-white/70">{t(`categories.${category.slug}.description`)}</span>
                    </span>
                    <ChevronRightIcon className="h-5 w-5 shrink-0 text-white/60 transition-transform duration-200 group-hover:translate-x-0.5 lg:hidden" strokeWidth={2.2} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <Wave className="block h-6 w-full rotate-180 sm:h-10" />
    </section>
  );
}

/** The band's soft edge: a long, low wave in the band's own colour. */
function Wave({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1440 48" preserveAspectRatio="none" className={`fill-ka-green-950 ${className}`}>
      <path d="M0 48V30C150 12 330 2 520 8c190 6 300 30 480 32 170 2 300-14 440-26v34z" />
    </svg>
  );
}
