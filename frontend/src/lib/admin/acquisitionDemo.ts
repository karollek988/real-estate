/**
 * Made-up measured traffic sources for the admin portal's Markov simulator, for looking at the page in
 * development without a database (ADMIN_STATS_DEMO=1, ignored in production). Clearly labelled as demo data
 * wherever it is shown. Roughly what a young site gets: mostly search engines, a little of the rest, no ads.
 */
import { buildMeasured, shiftDay, type ArrivalRow, type MeasuredAcquisition } from "@/lib/markov/measured";

export function buildDemoMeasured(today: string): MeasuredAcquisition {
  const rows: ArrivalRow[] = [
    { day: today, channel: "seo", source: "google", visitors: 575 },
    { day: today, channel: "seo", source: "bing", visitors: 41 },
    { day: today, channel: "seo", source: "duckduckgo", visitors: 24 },
    { day: today, channel: "ai", source: "chatgpt", visitors: 52 },
    { day: today, channel: "ai", source: "perplexity", visitors: 18 },
    { day: today, channel: "social", source: "facebook", visitors: 41 },
    { day: today, channel: "social", source: "instagram", visitors: 33 },
    { day: today, channel: "social", source: "linkedin", visitors: 21 },
    { day: today, channel: "direct", source: "none", visitors: 148 },
    { day: today, channel: "direct", source: "link", visitors: 62 },
  ];
  return buildMeasured(rows, [{ day: today, accepted: 1015, declined: 1180 }], shiftDay(today, -45), today, true);
}
