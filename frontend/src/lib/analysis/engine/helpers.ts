export function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Narrows an `attributes.housing_association_conflict` value (written by
 * identityTrust.ts when a lower-trust source disagrees with the trusted
 * housing-association name) into its known shape, or null if the stored
 * value is missing/malformed.
 */
export function housingAssociationConflictOrNull(
  value: unknown
): { keptValue: string; rejectedValue: string; rejectedSource: string } | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.keptValue !== "string" || typeof v.rejectedValue !== "string" || typeof v.rejectedSource !== "string") {
    return null;
  }
  return { keptValue: v.keptValue, rejectedValue: v.rejectedValue, rejectedSource: v.rejectedSource };
}

export interface AreaSoldPriceTrendPoint {
  period: string;
  medianPricePerM2Sek: number;
  count: number;
}

/**
 * Parses the quarterly area price-trend series set by
 * providers/booli.ts::summarizeSoldListings (`attributes.area_sold_price_trend`),
 * already sorted oldest to newest.
 */
export function parseAreaSoldPriceTrend(value: unknown): AreaSoldPriceTrendPoint[] {
  if (!Array.isArray(value)) return [];
  const points: AreaSoldPriceTrendPoint[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    if (typeof o.period === "string" && typeof o.medianPricePerM2Sek === "number" && typeof o.count === "number") {
      points.push({ period: o.period, medianPricePerM2Sek: o.medianPricePerM2Sek, count: o.count });
    }
  }
  return points;
}

/**
 * Overall % change between the earliest and latest quarter in a sold-price
 * trend series — the real ingredient area.ts's `area_price_trend_pct`
 * forward contract was waiting on. The span between quarters varies with
 * how many periods have comparable sales, so this is not a clean
 * year-over-year figure; callers should report the period span alongside
 * the percentage rather than label it "YoY".
 */
export function priceTrendFromSeries(
  points: AreaSoldPriceTrendPoint[]
): { pct: number; fromPeriod: string; toPeriod: string } | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.medianPricePerM2Sek <= 0) return null;
  const pct = ((last.medianPricePerM2Sek - first.medianPricePerM2Sek) / first.medianPricePerM2Sek) * 100;
  return { pct: Math.round(pct * 10) / 10, fromPeriod: first.period, toPeriod: last.period };
}
