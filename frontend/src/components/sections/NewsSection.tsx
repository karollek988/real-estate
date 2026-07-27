"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { SectionBackground } from "@/components/SectionBackground";
import { SectionIntro } from "@/components/SectionIntro";
import { ArrowRightIcon, CalendarIcon, NewspaperIcon } from "@/components/icons";
import type { NewsItem } from "@/lib/news/fetchNews";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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
    <section id="nyheter" className="relative scroll-mt-24">
      <SectionBackground src="/understand-market.png" />
      <div className="relative mx-auto w-full max-w-[1400px] px-6 pb-20 pt-24">
        <SectionIntro
          icon={NewspaperIcon}
          label="Nyheter"
          title="Förstå marknaden först"
          description="Håll koll på räntor, priser och beslut som påverkar värdet på din nästa bostad."
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {newsItems.map(({ headline, source, publishedAt, summary, url }, i) => (
            <Reveal key={url} variant="up" delay={i * 90} className="h-full">
              <article className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-green-500/30 hover:bg-white/[0.05]">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
                    {source}
                  </span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-neutral-500">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {formatDate(publishedAt)}
                  </span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold leading-snug">{headline}</h3>
                <p className="mt-3 flex-1 text-[13.5px] leading-relaxed text-neutral-400">
                  {summary}
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-green-400 transition-all hover:gap-3 hover:text-green-300"
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
