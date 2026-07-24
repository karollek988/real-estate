import type { DataProvider, ProviderResult } from "./types";

/**
 * Bridges the standalone `market_intelligence` Python package (built and
 * tested, but never called from any live request path — see
 * docs/44_production_release_checklist.md, B6) into the live analysis
 * pipeline via the FastAPI service in api/server.py.
 *
 * Scope note: the package's `housing_market` domain (house price index,
 * transactions) is a multi-period time series — turning that into a
 * defensible year-over-year trend percentage (what `area.ts`/`price.ts`
 * actually need) requires picking matching periods/regions correctly, and
 * 3 of the SCB-backed providers were observed returning HTTP 400s in a
 * live test run (upstream table-schema drift, unrelated to this bridge).
 * Rather than risk a wrong trend number reaching a customer, this
 * provider only lifts the `municipal_economics` domain's already-
 * latest-period-only findings (employment rate, tax rate) for the
 * property's own municipality — real numbers, stored for future analyzer
 * work, not yet claimed by any analyzer's forward contract.
 */

interface MIFinding {
  domain?: string;
  key?: string;
  value?: unknown;
  unit?: string;
  municipality?: string;
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
        headers: { "Content-Type": "application/json" },
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

    if (fields.length === 0) {
      return { source: { ...base, status: "no_data", fields: [], detail: `No municipal economics data matched "${property.municipality}".` }, data: {} };
    }

    return { source: { ...base, status: "ok", fields }, data };
  },
};
