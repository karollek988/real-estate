import type { DataProvider, ProviderResult } from "./types";
import { pythonEngineHeaders } from "@/lib/pythonEngine";

/**
 * Bridges the standalone `market_intelligence` Python package (built and
 * tested, but never called from any live request path — see
 * docs/44_production_release_checklist.md, B6) into the live analysis
 * pipeline via the FastAPI service in api/server.py.
 *
 * Lifts two domains:
 * - `municipal_economics` — latest-period-only employment rate and tax
 *   rate for the property's own municipality.
 * - `housing_market`'s `house_price_index` (SCB TAB1150, quarterly,
 *   base=100) — re-verified live 2026-09-18 (the HTTP 400s that justified
 *   skipping this domain were an upstream SCB issue that has since
 *   resolved; scb_housing_market.py's parser also had a real bug at the
 *   time, silently ignoring the table's Region dimension, fixed
 *   separately). Only the national ("00") row is used here — the table
 *   also carries Greater Stockholm/Gothenburg/Malmö and 8 riksområden
 *   series, real data available for a future more granular bridge, not
 *   pulled in yet to keep this change scoped. Exposed as a plain overall
 *   %-change over the returned window, the same "first vs. last period"
 *   shape `engine/helpers.ts::priceTrendFromSeries` already uses for
 *   Booli's comparables trend — kept as a separate, clearly-labeled
 *   attribute rather than merged into that one, since this is a national
 *   index number, not an area median price per m².
 */

interface MIFinding {
  domain?: string;
  key?: string;
  value?: unknown;
  unit?: string;
  municipality?: string;
  region?: string | null;
  validity?: { start?: string | null; end?: string | null } | null;
}
interface MIProviderEntry {
  provider_id?: string;
  status?: string;
  findings?: MIFinding[];
}
interface MIPackage {
  providers?: MIProviderEntry[];
}
interface MIResponse {
  success: boolean;
  package?: MIPackage;
  error?: string;
}

function findMunicipalityValue(
  pkg: MIPackage,
  municipality: string,
  key: string
): number | null {
  const target = municipality.trim().toLowerCase();
  for (const provider of pkg.providers ?? []) {
    for (const finding of provider.findings ?? []) {
      if (finding.domain !== "municipal_economics" || finding.key !== key) continue;
      if (finding.municipality?.trim().toLowerCase() !== target) continue;
      if (typeof finding.value === "number") return finding.value;
    }
  }
  return null;
}

interface IndexPoint {
  period: string;
  value: number;
}

/** The national ("00") `house_price_index` series, sorted oldest to newest by its validity window. */
function extractNationalHousePriceIndex(pkg: MIPackage): IndexPoint[] {
  const points: IndexPoint[] = [];
  for (const provider of pkg.providers ?? []) {
    for (const finding of provider.findings ?? []) {
      if (finding.domain !== "housing_market" || finding.key !== "house_price_index") continue;
      if (finding.region !== "00") continue; // metro/riksområde rows exist too — see file header
      if (typeof finding.value !== "number" || !finding.validity?.start) continue;
      points.push({ period: finding.validity.start, value: finding.value });
    }
  }
  return points.sort((a, b) => a.period.localeCompare(b.period));
}

export const marketIntelligenceProvider: DataProvider = {
  id: "market_intelligence",
  name: "Market Intelligence Engine",
  kind: "real",

  async collect({ property }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;

    if (!property.municipality) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "Property has no municipality yet (geocoding required first)." },
        data: {},
      };
    }

    const apiBase = process.env.PYTHON_ENGINE_API_URL;
    if (!apiBase) {
      return {
        source: { ...base, status: "not_connected", fields: [], detail: "Python engine API not configured (set PYTHON_ENGINE_API_URL)." },
        data: {},
      };
    }

    let res: Response;
    try {
      res = await fetch(`${apiBase.replace(/\/$/, "")}/api/market-intelligence`, {
        method: "POST",
        headers: pythonEngineHeaders(),
        body: JSON.stringify({ country: "SE", municipality: property.municipality }),
        signal: AbortSignal.timeout(60000),
        cache: "no-store",
      });
    } catch (err) {
      return {
        source: { ...base, status: "error", fields: [], detail: `Market intelligence request failed: ${err instanceof Error ? err.message : String(err)}` },
        data: {},
      };
    }

    if (!res.ok) {
      return { source: { ...base, status: "error", fields: [], detail: `Market intelligence engine responded ${res.status}` }, data: {} };
    }

    let body: MIResponse;
    try {
      body = (await res.json()) as MIResponse;
    } catch {
      return { source: { ...base, status: "error", fields: [], detail: "Market intelligence response was not valid JSON" }, data: {} };
    }

    if (!body.success || !body.package) {
      return { source: { ...base, status: "error", fields: [], detail: body.error ?? "Market intelligence engine returned an error" }, data: {} };
    }

    const employmentRate = findMunicipalityValue(body.package, property.municipality, "employment_rate");
    const taxRate = findMunicipalityValue(body.package, property.municipality, "municipal_tax_rate");
    const priceIndexPoints = extractNationalHousePriceIndex(body.package);

    const data: Record<string, unknown> = {};
    const fields: string[] = [];
    if (employmentRate !== null) {
      data.municipality_employment_rate_pct = employmentRate;
      fields.push("municipality_employment_rate_pct");
    }
    if (taxRate !== null) {
      data.municipality_tax_rate_pct = taxRate;
      fields.push("municipality_tax_rate_pct");
    }
    if (priceIndexPoints.length >= 2) {
      const first = priceIndexPoints[0];
      const last = priceIndexPoints[priceIndexPoints.length - 1];
      if (first.value > 0) {
        data.national_house_price_index_trend_pct = Math.round(((last.value - first.value) / first.value) * 1000) / 10;
        data.national_house_price_index_from_period = first.period;
        data.national_house_price_index_to_period = last.period;
        fields.push(
          "national_house_price_index_trend_pct",
          "national_house_price_index_from_period",
          "national_house_price_index_to_period"
        );
      }
    }

    if (fields.length === 0) {
      return { source: { ...base, status: "no_data", fields: [], detail: `No municipal economics data matched "${property.municipality}".` }, data: {} };
    }

    return { source: { ...base, status: "ok", fields }, data };
  },
};
