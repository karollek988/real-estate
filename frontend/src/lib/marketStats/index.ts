import { getPolicyRateSeries, type PolicyRateSeries } from "./riksbanken";
import { getInflationSeries, type InflationSeries } from "./kpif";
import { getHousePriceIndexSeries, type HousePriceIndexSeries } from "./housePriceIndex";
import { getPricePerSqmByArea, type SqmPriceData } from "./maklarstatistik";

export type { PolicyRateSeries, InflationSeries, HousePriceIndexSeries, SqmPriceData };

export interface MarketStats {
  policyRate: PolicyRateSeries | null;
  inflation: InflationSeries | null;
  housePriceIndex: HousePriceIndexSeries | null;
  pricePerSqm: SqmPriceData | null;
  fetchedAt: string;
}

/**
 * Aggregates every live market-stat source used on the public site (hero
 * "Marknadsöversikt" panel + the Marknadsinsikter cards) behind one cached
 * call, so both places show the same numbers and neither triggers its own
 * round of external fetches.
 *
 * Each source function already fails soft (returns null on any error —
 * network, timeout, unexpected response shape, etc.) rather than throwing,
 * so one source being briefly unavailable never blocks the others. On top
 * of that, this module keeps the last successful result per source and
 * serves it if a refresh attempt comes back null, so a transient outage
 * never blanks out a card that was working a moment ago.
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — matches the update cadence of the slowest source (Riksbank/SCB publish far less often, maklarstatistik.se ~monthly)

let cached: MarketStats | null = null;
let cachedAt = 0;
let lastGood: {
  policyRate: PolicyRateSeries | null;
  inflation: InflationSeries | null;
  housePriceIndex: HousePriceIndexSeries | null;
  pricePerSqm: SqmPriceData | null;
} = { policyRate: null, inflation: null, housePriceIndex: null, pricePerSqm: null };

export async function getMarketStats(): Promise<MarketStats> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

  const [policyRate, inflation, housePriceIndex, pricePerSqm] = await Promise.all([
    getPolicyRateSeries().catch(() => null),
    getInflationSeries().catch(() => null),
    getHousePriceIndexSeries().catch(() => null),
    getPricePerSqmByArea().catch(() => null),
  ]);

  lastGood = {
    policyRate: policyRate ?? lastGood.policyRate,
    inflation: inflation ?? lastGood.inflation,
    housePriceIndex: housePriceIndex ?? lastGood.housePriceIndex,
    pricePerSqm: pricePerSqm ?? lastGood.pricePerSqm,
  };

  cached = { ...lastGood, fetchedAt: new Date().toISOString() };
  cachedAt = now;
  return cached;
}
