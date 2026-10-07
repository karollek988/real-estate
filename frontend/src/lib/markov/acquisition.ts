/**
 * The acquisition model: where the simulator's "new visitors per month" come from.
 *
 * Five channels, each worked out the way that suits it:
 *   seo, social, ai   a level in month 1 that grows by some percent a month, up to a ceiling
 *   ads               a monthly budget in kr; every visitor costs more the more is spent
 *   direct            a fixed number per month (typed addresses, bookmarks, other sites linking)
 *
 * Every channel also has a quality: a factor on the chance that a visitor from it starts using the
 * site (visited -> engaged). 1 is the model's ordinary visitor, 1.4 is a visitor that is 40 % likelier
 * to engage. The factor moves people between "leaves at once" and "starts using it": the chance of
 * deciding either way stays what the probability table says (see visitedRow in engine.ts).
 *
 * No React, no browser: the engine and markov.verify.mjs use this directly.
 */

export const CHANNEL_IDS = ["seo", "ads", "social", "ai", "direct"] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

export interface ChannelInfo {
  label: string;
  description: string;
  kind: "growth" | "paid" | "fixed";
}

export const CHANNELS: Record<ChannelId, ChannelInfo> = {
  seo: {
    label: "Sökmotorer (SEO)",
    description: "Google och andra sökmotorer: gratis träffar på guider, områdessidor och verktyget. Växer långsamt men håller i sig.",
    kind: "growth",
  },
  ads: {
    label: "Annonser",
    description: "Betalda annonser. Mer budget ger fler besökare, men varje ny besökare blir dyrare.",
    kind: "paid",
  },
  social: {
    label: "Sociala medier",
    description: "Inlägg, grupper och delningar på sociala medier.",
    kind: "growth",
  },
  ai: {
    label: "AI-sökmotorer",
    description: "ChatGPT, Perplexity, Gemini och liknande som hänvisar till sidan i sina svar.",
    kind: "growth",
  },
  direct: {
    label: "Direkt och hänvisning",
    description: "Skriver in adressen, bokmärken, länkar från andra sidor och utskick.",
    kind: "fixed",
  },
};

/** A channel that grows by itself: visitors in month 1, monthly growth (0.04 = 4 %), and a ceiling per month. */
export interface GrowthChannel {
  start: number;
  growth: number;
  cap: number;
  quality: number;
}

/** Paid visitors. Cost per visitor is `costPerVisitor` at a tiny budget and doubles when the budget reaches `doublingSpend`. */
export interface AdsChannel {
  budget: number;
  costPerVisitor: number;
  doublingSpend: number;
  /** first and last month with ads running (1-based, inclusive) */
  from: number;
  to: number;
  quality: number;
}

export interface FixedChannel {
  visitors: number;
  quality: number;
}

export interface Acquisition {
  /** manual: the typed "new visitors per month" is used; channels: the five channels below are */
  mode: "manual" | "channels";
  seo: GrowthChannel;
  ads: AdsChannel;
  social: GrowthChannel;
  ai: GrowthChannel;
  direct: FixedChannel;
}

export const MAX_MONTHS = 36;
export const MIN_GROWTH = -0.5;
export const MAX_GROWTH = 1;
export const MAX_QUALITY = 5;

/** Example numbers, like the probabilities: assumptions to replace, not measurements. They add up to about 3 000 visitors in month 1. */
export const DEFAULT_ACQUISITION: Acquisition = {
  mode: "channels",
  seo: { start: 1200, growth: 0.04, cap: 6000, quality: 1 },
  ads: { budget: 15000, costPerVisitor: 12, doublingSpend: 40000, from: 1, to: MAX_MONTHS, quality: 0.8 },
  social: { start: 400, growth: 0.03, cap: 3000, quality: 0.6 },
  ai: { start: 200, growth: 0.1, cap: 4000, quality: 1.4 },
  direct: { visitors: 300, quality: 1.3 },
};

// ── the monthly numbers ──────────────────────────────────────────────────────

/** Visitors in `month` (1 is the first) from a channel that grows: start * (1 + growth)^(month - 1), never above the ceiling. */
export const growthVisitors = (channel: GrowthChannel, month: number) => Math.min(channel.cap, channel.start * (1 + channel.growth) ** (month - 1));

export const adsRunning = (ads: AdsChannel, month: number) => ads.budget > 0 && month >= ads.from && month <= ads.to;

/**
 * Visitors a monthly budget buys. The cost per visitor is c * (1 + budget / D), so the first krona buys
 * 1/c of a visitor and the visitors can never exceed D / c however much is spent:
 *     visitors = budget / (c * (1 + budget / D)) = budget * D / (c * (D + budget))
 */
export const adsVisitorsFor = (ads: AdsChannel, budget: number) => (budget <= 0 ? 0 : (budget * ads.doublingSpend) / (ads.costPerVisitor * (ads.doublingSpend + budget)));

export const adsVisitors = (ads: AdsChannel, month: number) => (adsRunning(ads, month) ? adsVisitorsFor(ads, ads.budget) : 0);

export interface AcquisitionPlan {
  months: number;
  /** visitors per month, per channel; month t is at index t (index 0 is 0: the start has no arrivals) */
  channels: Record<ChannelId, number[]>;
  /** all channels together, by month */
  total: number[];
  /** ad spend in kr by month */
  spend: number[];
}

/** What the channels bring each month for `months` months. */
export function acquisitionPlan(acquisition: Acquisition, months: number): AcquisitionPlan {
  const fill = (visitors: (month: number) => number) => Array.from({ length: months + 1 }, (_, t) => (t === 0 ? 0 : visitors(t)));
  const channels: Record<ChannelId, number[]> = {
    seo: fill((t) => growthVisitors(acquisition.seo, t)),
    ads: fill((t) => adsVisitors(acquisition.ads, t)),
    social: fill((t) => growthVisitors(acquisition.social, t)),
    ai: fill((t) => growthVisitors(acquisition.ai, t)),
    direct: fill(() => acquisition.direct.visitors),
  };
  return {
    months,
    channels,
    total: Array.from({ length: months + 1 }, (_, t) => CHANNEL_IDS.reduce((sum, id) => sum + channels[id][t], 0)),
    spend: fill((t) => (adsRunning(acquisition.ads, t) ? acquisition.ads.budget : 0)),
  };
}

export const qualityOf = (acquisition: Acquisition, id: ChannelId) => acquisition[id].quality;
