"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Reveal } from "@/components/Reveal";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ArrowUpRightIcon, CalendarIcon, NewspaperIcon } from "@/components/icons";
import { LOCALES, type AppLocale } from "@/i18n/locales";
import type { NewsItem } from "@/lib/news/fetchNews";

function formatDate(iso: string, locale: AppLocale) {
  return new Date(iso).toLocaleDateString(LOCALES[locale].formatLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The housing-market news on /nyheter: the latest items from public Swedish
 * feeds (Riksbanken, SVT, Dagens industri), filtered for housing, rates and
 * the economy by /api/news. Each card links to the original article.
 */
export function NewsSection() {
  const t = useTranslations("kunskap.news");
  const locale = useLocale() as AppLocale;
  const [newsItems, setNewsItems] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/news")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (!cancelled) setNewsItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setNewsItems([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="news-title" aria-busy={newsItems === null} className="bg-ka-cream">
      <div className={`${LANDING_CONTAINER} py-14 lg:py-20`}>
        <h2 id="news-title" className="sr-only">
          {t("heading")}
        </h2>

        {newsItems === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[260px] animate-pulse rounded-[22px] border border-ka-line bg-white/70" />
            ))}
          </div>
        ) : newsItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[22px] border border-ka-line bg-white px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ka-sage/70 text-ka-green-800">
              <NewspaperIcon className="h-6 w-6" />
            </span>
            <p className="text-[17px] font-semibold text-ka-ink">{t("empty.title")}</p>
            <p className="max-w-md text-[15px] leading-relaxed text-ka-muted">
              {t("empty.text")}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {newsItems.map(({ headline, source, publishedAt, summary, url }, i) => (
              <Reveal key={url} variant="up" delay={(i % 4) * 90} className="h-full">
                <article className="group flex h-full flex-col rounded-[22px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)] transition duration-300 hover:-translate-y-1 hover:border-ka-green-700/25">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-ka-sage/70 px-3 py-1 text-xs font-semibold text-ka-green-900">{source}</span>
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ka-muted">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <time dateTime={publishedAt}>{formatDate(publishedAt, locale)}</time>
                    </span>
                  </div>
                  <h3 lang="sv" className="mt-5 text-[17px] font-bold leading-snug text-ka-ink">{headline}</h3>
                  <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ka-muted" lang="sv">{summary}</p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-ka-green-700 transition hover:text-ka-green-900"
                  >
                    {t("readAt", { source })}
                    <ArrowUpRightIcon className="h-4 w-4" />
                    <span className="sr-only">{t("newTab")}</span>
                  </a>
                </article>
              </Reveal>
            ))}
          </div>
        )}

        <p className="mt-8 text-[13px] text-ka-muted">
          {t("footnote")}
          {locale !== "sv" && ` ${t("swedishNote")}`}
        </p>
      </div>
    </section>
  );
}
