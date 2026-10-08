import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";
import type { ContentItem } from "@/lib/content/model";
import { contentLink } from "@/lib/content/paths";
import { CategoryPill, DemoBadge } from "./CategoryPill";
import { useKunskap } from "./useKunskap";

/**
 * One guide, insight or news item in a grid. The whole card is the link (the
 * title's link stretches over it), with a white face, a firm edge and a
 * shadow so it stands clearly off the cream page, and a round arrow that
 * fills in on hover. `featured` gives it a green edge and an "Utvald" label.
 * The words: kunskap.*
 */
export function GuideCard({
  item,
  featured = false,
  headingLevel = 3,
  priority = false,
}: {
  item: ContentItem;
  featured?: boolean;
  headingLevel?: 2 | 3;
  priority?: boolean;
}) {
  const { t, date } = useKunskap();
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const when = item.publishedAt ?? item.updatedAt;

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[24px] border bg-white shadow-ka-card transition duration-300 ease-out hover:-translate-y-1 hover:shadow-ka-card-hover focus-within:ring-2 focus-within:ring-ka-green-700 focus-within:ring-offset-2 focus-within:ring-offset-ka-cream motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
        featured ? "border-ka-green-700/50" : "border-ka-line-strong hover:border-ka-green-700/40"
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ka-sand">
        {item.coverImage && (
          <Image
            src={item.coverImage}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 1280px) 30vw, (min-width: 1024px) 31vw, (min-width: 768px) 46vw, 100vw"
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        )}
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {featured && (
            <span className="rounded-full bg-ka-green-900 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">{t("featuredTag")}</span>
          )}
          {item.isDemo && <DemoBadge />}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6 sm:px-7 sm:pb-7">
        <CategoryPill category={item.category} className="relative -mt-3.5 self-start shadow-sm" />
        <Heading
          className={`font-display text-[22px] font-bold leading-[1.18] tracking-[-0.01em] text-ka-ink transition-colors group-hover:text-ka-green-800 sm:text-[23px] ${
            item.category ? "mt-4" : "mt-6"
          }`}
        >
          <Link href={contentLink(item)} className="outline-none after:absolute after:inset-0 after:content-['']">
            {item.title}
          </Link>
        </Heading>
        <p className="mt-3 line-clamp-3 flex-1 text-[15.5px] leading-[1.6] text-ka-muted">{item.excerpt}</p>
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-ka-line pt-4">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-ka-muted">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4" />
              {t("readingTime", { minutes: item.readingMinutes })}
            </span>
            <span aria-hidden>·</span>
            <time dateTime={when}>{date(when)}</time>
          </p>
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ka-line-strong bg-ka-cream text-ka-green-800 transition duration-300 group-hover:border-ka-green-900 group-hover:bg-ka-green-900 group-hover:text-white"
          >
            <ArrowRightIcon className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
