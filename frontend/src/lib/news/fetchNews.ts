import { XMLParser } from "fast-xml-parser";

export type NewsItem = {
  headline: string;
  source: string;
  publishedAt: string;
  summary: string;
  url: string;
};

type FeedConfig = {
  source: string;
  url: string;
};

// Public Swedish RSS feeds covering the housing market, mortgages, interest
// rates, banks and the wider economy. Items are keyword-filtered below since
// none of these feeds are scoped to housing/finance alone.
const FEEDS: FeedConfig[] = [
  { source: "Sveriges Riksbank", url: "https://www.riksbank.se/sv/rss/pressmeddelanden/" },
  { source: "SVT Nyheter", url: "https://www.svt.se/nyheter/ekonomi/rss.xml" },
  { source: "Dagens industri", url: "https://www.di.se/rss" },
];

const KEYWORDS = [
  "bostad", "bostäder", "bostadsmarknad", "bostadsrätt", "bostadsrätter",
  "bostadspris", "bostadspriser", "villapris", "villa", "hyresrätt", "hyresrätter",
  "boende", "nyproduktion", "bygg", "byggbolag", "byggföretag",
  "ränta", "räntor", "styrränta", "riksbank", "riksbanken", "bolån", "boränta",
  "boräntor", "amortering", "amorteringskrav",
  "bank", "banker", "swedbank", "seb", "handelsbanken", "nordea", "sbab",
  "fastighet", "fastigheter", "fastighetsmarknad", "hyra", "hyror", "hyresgäst",
  "inflation", "kpi", "kpif", "konjunktur",
];

const MAX_ITEMS = 8;
const SUMMARY_MAX_LENGTH = 180;
const FEED_TIMEOUT_MS = 6000;
const REVALIDATE_SECONDS = 1800;

let lastGoodResult: NewsItem[] | null = null;

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return `${input.slice(0, maxLength - 1).trimEnd()}…`;
}

function matchesKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return KEYWORDS.some((keyword) => lower.includes(keyword));
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function fetchFeed(feed: FeedConfig): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);

  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KopanalysNewsBot/1.0)" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
    const parsed = parser.parse(xml);
    const rawItems = parsed?.rss?.channel?.item;
    const items: unknown[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

    const results: NewsItem[] = [];
    for (const raw of items) {
      if (typeof raw !== "object" || raw === null) continue;
      const item = raw as Record<string, unknown>;

      const title = typeof item.title === "string" ? item.title.trim() : "";
      const link = typeof item.link === "string" ? item.link.trim() : "";
      const description = typeof item.description === "string" ? stripHtml(item.description) : "";
      const publishedAt = parseDate(item.pubDate) ?? parseDate(item["dc:date"]);

      if (!title || !link || !publishedAt) continue;
      if (!matchesKeywords(`${title} ${description}`)) continue;

      results.push({
        headline: title,
        source: feed.source,
        publishedAt,
        summary: truncate(description, SUMMARY_MAX_LENGTH),
        url: link,
      });
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getHousingMarketNews(): Promise<NewsItem[]> {
  const perFeed = await Promise.all(FEEDS.map(fetchFeed));
  const combined = perFeed.flat();

  const seen = new Set<string>();
  const deduped = combined.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  deduped.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const top = deduped.slice(0, MAX_ITEMS);

  if (top.length > 0) {
    lastGoodResult = top;
    return top;
  }

  // All feeds were unavailable or returned nothing relevant — fall back to
  // the last successful fetch rather than showing an empty section.
  return lastGoodResult ?? [];
}
