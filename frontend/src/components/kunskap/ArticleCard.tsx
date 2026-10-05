import Link from "next/link";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";
import { articleHref, formatArticleDate, type Article } from "@/lib/kunskap/articles";

/** One article in a list (/blogg, /guider, "Läs vidare"). `featured` spans wider with a larger title. */
export function ArticleCard({ article, featured = false, step }: { article: Article; featured?: boolean; step?: number }) {
  return (
    <article className="h-full">
      <Link
        href={articleHref(article)}
        className={`group flex h-full flex-col rounded-[22px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)] transition duration-300 hover:-translate-y-1 hover:border-ka-green-700/30 hover:shadow-[0_28px_56px_-34px_rgba(15,31,24,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 sm:p-7 ${
          featured ? "lg:p-9" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {step !== undefined && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ka-green-800 text-[13px] font-bold text-white">
              {step}
            </span>
          )}
          <span className="rounded-full bg-ka-sage/70 px-3 py-1 text-[12px] font-semibold text-ka-green-900">{article.category}</span>
          <span className="rounded-full border border-ka-line px-2.5 py-0.5 text-[12px] font-medium text-ka-muted">
            {article.kind === "guide" ? "Guide" : "Blogg"}
          </span>
        </div>
        <h3
          className={`mt-5 font-display font-bold leading-[1.15] tracking-[-0.01em] text-ka-ink transition group-hover:text-ka-green-800 ${
            featured ? "text-[28px] sm:text-[34px]" : "text-[22px]"
          }`}
        >
          {article.title}
        </h3>
        <p className={`mt-3 flex-1 leading-relaxed text-ka-muted ${featured ? "text-[16.5px]" : "text-[15px]"}`}>{article.excerpt}</p>
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-ka-line pt-4 text-[13px] text-ka-muted">
          <span className="flex items-center gap-1.5">
            <ClockIcon className="h-4 w-4" />
            {article.readingMinutes} min läsning · {formatArticleDate(article.publishedAt)}
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-ka-green-700">
            Läs
            <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </article>
  );
}
