import type { AnalysisReport, ReportFactor } from "./types";

/**
 * Brings a stored report up to the current shape when it is read.
 *
 * Reports persisted before 2026-10-02 (engine < 0.6.0) were written by the old
 * Decision Engine and carry what the report no longer has: an overall
 * `decisionScore` / `verdict` / `overallConfidence`, a composed `summary`,
 * `insights`, and — on every factor — a numeric `score`, `confidence`, `weight`
 * and English `status`/`explanation` text. None of that is shown or used any
 * more, so it is dropped here, at the single place stored reports enter the
 * app (store.ts), and everything downstream only ever sees the clean
 * `ReportFactor` shape. Factors of parts that no longer exist (price level,
 * negotiation, data confidence) are dropped with it.
 *
 * A legacy factor counts as `available` exactly when it had a score (the old
 * engine used `score: null` for "not enough data"), and the housing-association
 * factor's report state, which used to live in its score and English status
 * string, is carried over into `supportingData.reportState`.
 */

const KNOWN_FACTOR_IDS = new Set(["area", "market", "housingAssociation", "risk", "futureDevelopment"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeFactor(raw: unknown): ReportFactor | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !KNOWN_FACTOR_IDS.has(raw.id)) return null;

  const supportingData: Record<string, unknown> = isRecord(raw.supportingData) ? { ...raw.supportingData } : {};
  const available = typeof raw.available === "boolean" ? raw.available : typeof raw.score === "number";

  if (raw.id === "housingAssociation" && supportingData.reportState === undefined) {
    supportingData.reportState =
      raw.status === "Insufficient verified data" ? "unusable" : available ? "verified" : "none";
  }
  return { id: raw.id, available, supportingData };
}

export function normalizeStoredReport(raw: unknown): AnalysisReport | null {
  if (!isRecord(raw)) return null;
  const {
    decisionScore: _decisionScore,
    overallConfidence: _overallConfidence,
    verdict: _verdict,
    summary: _summary,
    insights: _insights,
    factorsAnalyzed: _factorsAnalyzed,
    decisionFactors,
    ...rest
  } = raw;
  const factors = (Array.isArray(decisionFactors) ? decisionFactors : [])
    .map(normalizeFactor)
    .filter((f): f is ReportFactor => f !== null);
  return { ...rest, decisionFactors: factors } as unknown as AnalysisReport;
}
