import type { DataProvider, ProviderResult } from "./types";
import { fetchJson } from "./httpJson";

/**
 * Real provider: Sveriges Riksbank SWEA API — free, keyless
 * (docs/data-source-inventory.md entry 12). Reuses the `interest_rates`
 * id/placeholder from the previous milestone.
 *
 * Fetches the policy rate (styrränta, series SECBREPOEFF) — its current
 * value and the value from 12 months ago, so the change is a real,
 * computed fact rather than a single snapshot presented as a "trend".
 * Not property-specific — same for every analysis, cached implicitly by
 * being cheap and fast.
 */

const SERIES_ID = "SECBREPOEFF";
const OBSERVATIONS_ENDPOINT = "https://api.riksbank.se/swea/v1/Observations";

interface Observation {
  date: string;
  value: number;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Finds the observation on or most recently before `targetDate`. */
function latestOnOrBefore(observations: Observation[], targetDate: string): Observation | null {
  const eligible = observations.filter((o) => o.date <= targetDate);
  if (eligible.length === 0) return null;
  return eligible.reduce((latest, o) => (o.date > latest.date ? o : latest));
}

export const riksbankenInterestRateProvider: DataProvider = {
  id: "interest_rates",
  name: "Interest rates (Riksbanken)",
  kind: "real",

  async collect(): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;

    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const from = toIsoDate(new Date(oneYearAgo.getTime() - 14 * 86_400_000)); // small buffer for weekends/holidays
    const to = toIsoDate(today);

    const result = await fetchJson<Observation[]>(
      `${OBSERVATIONS_ENDPOINT}/${SERIES_ID}/${from}/${to}`
    );

    if (!result.ok) {
      return { source: { ...base, status: "error", fields: [], detail: result.error }, data: {} };
    }
    if (result.data.length === 0) {
      return { source: { ...base, status: "no_data", fields: [], detail: "Riksbanken returned no observations." }, data: {} };
    }

    const sorted = [...result.data].sort((a, b) => (a.date < b.date ? -1 : 1));
    const latest = sorted[sorted.length - 1];
    const yearAgo = latestOnOrBefore(sorted, toIsoDate(oneYearAgo));

    const data: Record<string, unknown> = {
      policy_rate_pct: latest.value,
      policy_rate_date: latest.date,
    };
    const fields = ["policy_rate_pct", "policy_rate_date"];

    if (yearAgo) {
      data.policy_rate_change_12m_pct_points = Math.round((latest.value - yearAgo.value) * 100) / 100;
      fields.push("policy_rate_change_12m_pct_points");
    }

    return { source: { ...base, status: "ok", fields }, data };
  },
};
