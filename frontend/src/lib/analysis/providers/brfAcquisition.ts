import type { DataProvider, ProviderResult } from "./types";

/**
 * Bridges BRF-Scraper's ProfileEngine (Hemnet + Booli + Allabrf +
 * official-website discovery, PDF download, and PDF extraction — all
 * already implemented under BRF-Scraper/src/brf_scraper) into the live
 * analysis pipeline, via the FastAPI service in api/server.py.
 *
 * This provider does no discovery, downloading, or PDF parsing itself —
 * it forwards the property's Hemnet URL to POST /api/brf-annual-report,
 * which runs ProfileEngine.build() and returns BRFProfile.to_analysis_input()
 * directly: one fiscal year's verified annual-report JSON, in the exact
 * shape brfFinancials.ts / calculate_metrics() expect. Runs before
 * brfFinancialsProvider in the registry so `attributes.brf_annual_report`
 * is set in time for that provider to pick it up in the same pipeline run
 * (pipeline.ts merges each provider's attributes into the in-memory
 * property before calling the next provider).
 */

interface BrfAnnualReportResponse {
  success: boolean;
  annual_report?: Record<string, unknown>;
  brf?: { name?: string; organization_number?: string };
  error?: string;
}

export const brfAcquisitionProvider: DataProvider = {
  id: "brf_acquisition",
  name: "BRF annual report acquisition (Hemnet/Allabrf)",
  kind: "real",

  async collect({ property, extracted }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;

    const hemnetUrl = property.hemnetUrl ?? extracted.hemnetUrl;
    if (!hemnetUrl) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "No Hemnet URL for this property." },
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
      res = await fetch(`${apiBase.replace(/\/$/, "")}/api/brf-annual-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hemnet_url: hemnetUrl }),
        // Discovery + crawl + PDF download + extraction can genuinely take
        // over a minute for a cold (unregistered) BRF — much longer than
        // the other Python-engine providers' 30-60s budgets.
        signal: AbortSignal.timeout(120000),
        cache: "no-store",
      });
    } catch (err) {
      return {
        source: {
          ...base,
          status: "error",
          fields: [],
          detail: `BRF acquisition request failed: ${err instanceof Error ? err.message : String(err)}`,
        },
        data: {},
      };
    }

    let body: BrfAnnualReportResponse;
    try {
      body = (await res.json()) as BrfAnnualReportResponse;
    } catch {
      return {
        source: { ...base, status: "error", fields: [], detail: `BRF acquisition response was not valid JSON (HTTP ${res.status})` },
        data: {},
      };
    }

    if (!res.ok || !body.success || !body.annual_report) {
      // A 422 with no report found is an expected outcome (association not
      // on allabrf.se, no readable annual report, ...), not a system error.
      const status = res.ok || res.status === 422 ? "no_data" : "error";
      return {
        source: {
          ...base,
          status,
          fields: [],
          detail: body.error ?? `BRF acquisition engine responded ${res.status}`,
        },
        data: {},
      };
    }

    const data: Record<string, unknown> = { brf_annual_report: body.annual_report };
    if (body.brf?.name) data.housing_association = body.brf.name;

    return {
      source: { ...base, status: "ok", fields: Object.keys(data) },
      data,
    };
  },
};
