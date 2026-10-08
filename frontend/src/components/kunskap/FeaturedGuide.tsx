import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";
import type { ContentItem } from "@/lib/content/model";
import { contentLink } from "@/lib/content/paths";
import { CategoryPill, DemoBadge } from "./CategoryPill";
import { useKunskap } from "./useKunskap";

/**
 * The item a hub leads with: a wide card, picture on one side and the story
 * on the other (stacked on phones). Fed by any ContentItem - the hub picks the
 * newest one marked "featured" (repository.ts pickFeatured). The words: kunskap.*
 */
export function FeaturedGuide({ item, label }: { item: ContentItem; label: string }) {
  const { t, date } = useKunskap();
  const published = item.publishedAt ?? item.updatedAt;
  const updatedLater = item.publishedAt && Date.parse(item.updatedAt) - Date.parse(item.publishedAt) > 86_400_000;

  return (
    <article className="group relative grid overflow-hidden rounded-[28px] border border-ka-line-strong bg-white shadow-ka-card transition duration-300 hover:shadow-ka-card-hover focus-within:ring-2 focus-within:ring-ka-green-700 focus-within:ring-offset-2 focus-within:ring-offset-ka-cream lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-ka-sand lg:aspect-auto lg:min-h-[440px]">
        {item.coverImage && (
          <Image
            src={item.coverImage}
            alt={item.coverImageAlt}
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        )}
        {item.isDemo && <DemoBadge className="absolute left-4 top-4" />}
      </div>

      <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12 xl:p-14">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-ka-green-700">{label}</span>
          <CategoryPill category={item.category} />
        </div>
        <h3 className="mt-5 font-display text-[30px] font-bold leading-[1.08] tracking-[-0.02em] text-ka-ink sm:text-[38px] xl:text-[44px]">
          <Link href={contentLink(item)} className="outline-none after:absolute after:inset-0 after:content-['']">
            {item.title}
          </Link>
        </h3>
        <p className="mt-4 max-w-[560px] text-[16.5px] leading-[1.65] text-ka-muted sm:text-[17.5px]">{item.excerpt}</p>
        <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ka-muted">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="h-4 w-4" />
            {t("readingTime", { minutes: item.readingMinutes })}
          </span>
          <span aria-hidden>·</span>
          {updatedLater ? (
            <time dateTime={item.updatedAt}>{t("updated", { date: date(item.updatedAt) })}</time>
          ) : (
            <time dateTime={published}>{date(published)}</time>
          )}
        </p>
        <span
          aria-hidden
          className="mt-8 inline-flex h-[52px] w-fit items-center gap-2.5 rounded-[12px] bg-ka-green-900 px-6 text-[15.5px] font-semibold text-white shadow-[0_14px_30px_-16px_rgba(12,42,31,0.9)] transition duration-200 group-hover:bg-ka-green-800"
        >
          {t(`types.${item.type}.read`)}
          <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
