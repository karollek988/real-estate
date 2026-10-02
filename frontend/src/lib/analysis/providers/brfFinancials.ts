import type { DataProvider, ProviderResult } from "./types";
import { pythonEngineHeaders } from "@/lib/pythonEngine";

/**
 * The BRF chapter's data: bridges the `analysis_engine` Python library
 * (calculator.py + reasoning.py — deterministic BRF financial calculations
 * and rule-based reasoning) into the live analysis pipeline via the FastAPI
 * service in api/server.py, the same pattern locationIntelligence.ts and
 * marketIntelligence.ts use.
 *
 * Where the numbers come from: ONLY from an annual report the buyer has
 * uploaded (api/properties/[id]/brf-report/route.ts extracts it through the
 * Python engine and stores it as `property.attributes.brf_annual_report`).
 * Nothing in the pipeline finds, looks up or downloads a BRF report — the
 * automated acquisition (Hemnet/Booli/Allabrf crawl) was removed on
 * 2026-10-02. Without an uploaded report this provider reports
 * "not_connected" and the chapter asks the buyer to upload one.
 *
 * This provider does not compute anything itself — it forwards one fiscal
 * year's verified annual-report JSON to POST /api/brf-financials, which
 * calls calculate_metrics() + run_reasoning() and returns their output as
 * structured JSON. Those two functions remain the only place BRF financial
 * reasoning happens; this provider and lib/report/build.ts only consume their
 * output. Forward contract: `attributes.brf_annual_report` must be the
 * one-fiscal-year JSON shape calculate_metrics() consumes directly — see
 * analysis_engine/sample_annual_report.json's `annual_reports[0]`.
 */

export interface CalculatedFieldDto {
  value: number | null;
  unit: string;
  formula: string;
  inputs: string[];
  inputValues: (number | null)[];
  computed: boolean;
}

export interface CalculatedMetricsDto {
  fiscalYear: number;
  debtPerApartment: CalculatedFieldDto | null;
  equityPerApartment: CalculatedFieldDto | null;
  revenuePerApartment: CalculatedFieldDto | null;
  costPerApartment: CalculatedFieldDto | null;
  equityRatio: CalculatedFieldDto | null;
  debtRatio: CalculatedFieldDto | null;
  operatingMargin: CalculatedFieldDto | null;
  interestCoverage: CalculatedFieldDto | null;
  costPerSqm: CalculatedFieldDto | null;
  feeSustainability: CalculatedFieldDto | null;
  totalDebt: CalculatedFieldDto | null;
  weightedAverageInterest: CalculatedFieldDto | null;
  shortTermDebtRatio: CalculatedFieldDto | null;
  interestCostPerApartment: CalculatedFieldDto | null;
  debtToEquity: CalculatedFieldDto | null;
  liquidityMonths: CalculatedFieldDto | null;
}

export type SignalStrengthDto =
  | "strong_positive"
  | "positive"
  | "weak_positive"
  | "neutral"
  | "weak_negative"
  | "negative"
  | "strong_negative"
  | "unknown";

export interface SignalDto {
  metric: string;
  value: number | null;
  strength: SignalStrengthDto;
  thresholdDescription: string;
  confidence: number;
}

export type FindingClassificationDto = "strength" | "weakness" | "mixed" | "neutral" | "unknown";
export type SeverityDto = "minor" | "moderate" | "significant" | "critical" | null;

export interface FindingDto {
  dimension: string;
  classification: FindingClassificationDto;
  severity: SeverityDto;
  summary: string;
  confidence: number;
  signalMetrics: string[];
}

export interface RecommendationDto {
  category: string;
  text: string;
  confidence: number;
  findingDimensions: string[];
}

export interface ReasoningDto {
  signals: SignalDto[];
  observations: Array<{
    dimension: string;
    statement: string;
    isFact: boolean;
    confidence: number;
    signalMetrics: string[];
  }>;
  findings: FindingDto[];
  recommendations: RecommendationDto[];
  overallConfidence: number;
}

/**
 * "ok": at least one financial signal was computed from verified data.
 * "insufficient_verified_data": an annual report was uploaded and extracted,
 * but nothing in it passed validation (see BRF-Scraper's
 * extractor/validation.py) — the report must say so rather than show numbers
 * it can't stand behind. Distinct from the provider-level "not_connected"
 * status below, which means no annual report was uploaded at all.
 */
export type BrfFinancialDataStatus = "ok" | "insufficient_verified_data";

/** The exact shape `attributes.brf_financial_analysis` is set to when this provider succeeds. */
export interface BrfFinancialAnalysis {
  status: BrfFinancialDataStatus;
  metrics: CalculatedMetricsDto;
  reasoning: ReasoningDto;
}

interface BrfFinancialsResponse {
  success: boolean;
  status?: BrfFinancialDataStatus;
  metrics?: CalculatedMetricsDto;
  reasoning?: ReasoningDto;
  error?: string;
}

export const brfFinancialsProvider: DataProvider = {
  id: "brf_financials",
  name: "Housing association annual report (uploaded by the buyer)",
  kind: "real",

  async collect({ property, extracted }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;

    const annualReport = property.attributes.brf_annual_report ?? extracted.attributes.brf_annual_report;
    if (!annualReport || typeof annualReport !== "object") {
      return {
        source: {
          ...base,
          status: "not_connected",
          fields: [],
          detail:
            "No annual report has been uploaded for this association yet. BRF reports are uploaded by the " +
            "buyer; nothing fetches them automatically.",
        },
        data: {},
      };
    }

    const apiBase = process.env.PYTHON_ENGINE_API_URL;
    if (!apiBase) {
      return {
        source: {
          ...base,
          status: "not_connected",
          fields: [],
          detail: "Python engine API not configured (set PYTHON_ENGINE_API_URL).",
        },
        data: {},
      };
    }

    let res: Response;
    try {
      res = await fetch(`${apiBase.replace(/\/$/, "")}/api/brf-financials`, {
        method: "POST",
        headers: pythonEngineHeaders(),
        body: JSON.stringify({ annual_report: annualReport }),
        signal: AbortSignal.timeout(30000),
        cache: "no-store",
      });
    } catch (err) {
      return {
        source: {
          ...base,
          status: "error",
          fields: [],
          detail: `BRF financials request failed: ${err instanceof Error ? err.message : String(err)}`,
        },
        data: {},
      };
    }

    if (!res.ok) {
      return {
        source: { ...base, status: "error", fields: [], detail: `BRF financials engine responded ${res.status}` },
        data: {},
      };
    }

    let body: BrfFinancialsResponse;
    try {
      body = (await res.json()) as BrfFinancialsResponse;
    } catch {
      return { source: { ...base, status: "error", fields: [], detail: "BRF financials response was not valid JSON" }, data: {} };
    }

    if (!body.success || !body.metrics || !body.reasoning) {
      return {
        source: { ...base, status: "error", fields: [], detail: body.error ?? "BRF financials engine returned an error" },
        data: {},
      };
    }

    const analysis: BrfFinancialAnalysis = {
      status: body.status ?? "ok",
      metrics: body.metrics,
      reasoning: body.reasoning,
    };
    return {
      source: { ...base, status: "ok", fields: ["brf_financial_analysis"] },
      data: { brf_financial_analysis: analysis },
    };
  },
};
