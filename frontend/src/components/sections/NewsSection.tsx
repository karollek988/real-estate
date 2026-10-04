"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ArrowRightIcon, CalendarIcon, NewspaperIcon } from "@/components/icons";
import type { NewsItem } from "@/lib/news/fetchNews";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Rendered inside the landing page's #nyheter block (the header's "Blogg & Nyheter"), after the market data. */
export function NewsSection() {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

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

  if (newsItems.length === 0) return null;

  return (
    <section aria-labelledby="news-title" className="relative">
      <div className={`${LANDING_CONTAINER} pb-20 pt-4 lg:pb-28`}>
        <SectionIntro
          icon={NewspaperIcon}
          label="Nyheter"
          title={<span id="news-title">Förstå marknaden först</span>}
          description="Håll koll på räntor, priser och beslut som påverkar värdet på din nästa bostad."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {newsItems.map(({ headline, source, publishedAt, summary, url }, i) => (
            <Reveal key={url} variant="up" delay={i * 90} className="h-full">
              <article className="group flex h-full flex-col rounded-[22px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)] transition duration-300 hover:-translate-y-1 hover:border-ka-green-700/25">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-ka-sage/70 px-3 py-1 text-xs font-semibold text-ka-green-900">{source}</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-ka-muted">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {formatDate(publishedAt)}
                  </span>
                </div>
                <h3 className="mt-5 text-[17px] font-bold leading-snug text-ka-ink">{headline}</h3>
                <p className="mt-3 flex-1 text-[14px] leading-relaxed text-ka-muted">{summary}</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-ka-green-700 transition-all hover:gap-3 hover:text-ka-green-900"
                >
                  Läs mer
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
