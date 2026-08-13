import { fetchJson } from "@/lib/analysis/providers/httpJson";

/**
 * Live policy rate ("styrränta") series from Sveriges Riksbank's SWEA API —
 * free, keyless, official (docs/data-source-inventory.md entry 12). Same
 * series (SECBREPOEFF) already used by the per-property analysis provider
 * at src/lib/analysis/providers/riksbanken.ts, but resampled here into a
 * quarterly step series for the homepage/insights charts instead of a
 * single latest-value snapshot.
 */

const SERIES_ID = "SECBREPOEFF";
const OBSERVATIONS_ENDPOINT = "https://api.riksbank.se/swea/v1/Observations";
const QUARTERS_TO_SHOW = 10;

interface Observation {
  date: string;
  value: number;
}

export interface PolicyRateSeries {
  values: number[];
  quarterLabels: string[];
  latest: number;
  latestDate: string;
  change12mPtPct: number | null;
  asOf: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function quarterIndex0(date: Date): number {
  return Math.floor(date.getUTCMonth() / 3);
}

/** Start-of-quarter date, in UTC, for the given (year, 0-based quarter). */
function quarterStartDate(year: number, q0: number): Date {
  return new Date(Date.UTC(year, q0 * 3, 1));
}

function latestOnOrBefore(observations: Observation[], targetIso: string): Observation | null {
  const eligible = observations.filter((o) => o.date <= targetIso);
  if (eligible.length === 0) return null;
  return eligible.reduce((latest, o) => (o.date > latest.date ? o : latest));
}

export async function getPolicyRateSeries(): Promise<PolicyRateSeries | null> {
  const today = new Date();
  const yearsBack = Math.ceil(QUARTERS_TO_SHOW / 4) + 2;
  const from = new Date(today);
  from.setFullYear(from.getFullYear() - yearsBack);

  const result = await fetchJson<Observation[]>(
    `${OBSERVATIONS_ENDPOINT}/${SERIES_ID}/${toIsoDate(from)}/${toIsoDate(today)}`,
    {},
    10000
  );
  if (!result.ok || result.data.length === 0) return null;

  const sorted = [...result.data].sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = sorted[sorted.length - 1];

  // Build the last QUARTERS_TO_SHOW quarter markers, walking backward from
  // today's quarter. Every quarter except the current (still in progress)
  // one is sampled at its start date; the current quarter is sampled as of
  // today, so the chart's final point is always the true current rate.
  const markers: { year: number; q0: number; sampleIso: string }[] = [];
  let y = today.getUTCFullYear();
  let q = quarterIndex0(today);
  for (let i = 0; i < QUARTERS_TO_SHOW; i++) {
    markers.unshift({
      year: y,
      q0: q,
      sampleIso: i === 0 ? toIsoDate(today) : toIsoDate(quarterStartDate(y, q)),
    });
    q -= 1;
    if (q < 0) {
      q = 3;
      y -= 1;
    }
  }

  const values: number[] = [];
  const quarterLabels: string[] = [];
  for (const marker of markers) {
    const obs = latestOnOrBefore(sorted, marker.sampleIso);
    if (!obs) continue;
    values.push(obs.value);
    quarterLabels.push(`${marker.year}K${marker.q0 + 1}`);
  }
  if (values.length === 0) return null;

  const oneYearAgoIso = toIsoDate(new Date(new Date(latest.date).setFullYear(new Date(latest.date).getFullYear() - 1)));
  const yearAgo = latestOnOrBefore(sorted, oneYearAgoIso);
  const change12mPtPct = yearAgo ? Math.round((latest.value - yearAgo.value) * 100) / 100 : null;

  return {
    values,
    quarterLabels,
    latest: latest.value,
    latestDate: latest.date,
    change12mPtPct,
    asOf: latest.date,
  };
}
