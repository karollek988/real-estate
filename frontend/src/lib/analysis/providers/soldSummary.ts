/**
 * Shape-agnostic core of "split a sold-listings result set into the subject
 * property's own sale history vs. area comparables, then derive the area
 * median price/m² and a quarterly trend". Extracted from booli.ts so
 * providers with a differently-shaped sold-listings response (e.g. Parse.bot's
 * Booli.se API, which is flat where Booli API v2 is nested) can reuse the
 * same algorithm without reshaping their data into Booli v2's schema first.
 */

export interface RawSoldEntry {
  streetAddress: string | null;
  soldPriceSek: number;
  soldDate: string | null;
  livingAreaM2: number | null;
  rooms: number | null;
}

export interface ComparableSale {
  address: string | null;
  soldPriceSek: number;
  soldDate: string | null;
  livingAreaM2: number | null;
  rooms: number | null;
  pricePerM2Sek: number | null;
}

export interface SoldSummary {
  previousSalePriceSek: number | null;
  previousSaleDate: string | null;
  comparableSales: ComparableSale[];
  comparableSalesCount: number;
  areaMedianPricePerM2Sek: number | null;
  areaSoldPriceTrend: { period: string; medianPricePerM2Sek: number; count: number }[];
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function quarterKey(dateStr: string): string | null {
  const d = new Date(dateStr.replace(" ", "T"));
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

export function summarizeSold(
  entries: RawSoldEntry[],
  targetAddress: string,
  addressesMatch: (target: string, candidate: string | null | undefined) => boolean,
  opts: { maxComparablesReturned: number }
): SoldSummary {
  let previousSale: { priceSek: number; date: string | null } | null = null;
  const comparables: ComparableSale[] = [];

  for (const e of entries) {
    const pricePerM2 = e.livingAreaM2 && e.livingAreaM2 > 0 ? Math.round(e.soldPriceSek / e.livingAreaM2) : null;

    if (addressesMatch(targetAddress, e.streetAddress)) {
      if (!previousSale || (e.soldDate ?? "") > (previousSale.date ?? "")) {
        previousSale = { priceSek: e.soldPriceSek, date: e.soldDate ?? null };
      }
      continue;
    }

    comparables.push({
      address: e.streetAddress ?? null,
      soldPriceSek: e.soldPriceSek,
      soldDate: e.soldDate ?? null,
      livingAreaM2: e.livingAreaM2 ?? null,
      rooms: e.rooms ?? null,
      pricePerM2Sek: pricePerM2,
    });
  }

  comparables.sort((a, b) => (b.soldDate ?? "").localeCompare(a.soldDate ?? ""));

  const byQuarter = new Map<string, number[]>();
  for (const c of comparables) {
    if (c.pricePerM2Sek === null || !c.soldDate) continue;
    const key = quarterKey(c.soldDate);
    if (!key) continue;
    const bucket = byQuarter.get(key) ?? [];
    bucket.push(c.pricePerM2Sek);
    byQuarter.set(key, bucket);
  }
  const areaSoldPriceTrend = [...byQuarter.entries()]
    .map(([period, values]) => ({ period, medianPricePerM2Sek: median(values) as number, count: values.length }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return {
    previousSalePriceSek: previousSale?.priceSek ?? null,
    previousSaleDate: previousSale?.date ?? null,
    comparableSales: comparables.slice(0, opts.maxComparablesReturned),
    comparableSalesCount: comparables.length,
    areaMedianPricePerM2Sek: median(comparables.map((c) => c.pricePerM2Sek).filter((v): v is number => v !== null)),
    areaSoldPriceTrend,
  };
}
