import type { DecisionFactorResult } from "../../types";
import type { AnalyzerContext } from "./types";

const ID = "confidence";
const LABEL = "Data Confidence";

/**
 * Confidence Analyzer — the meta-analyzer. Unlike the other 7, it doesn't
 * judge the property; it judges how much of the full data picture this
 * analysis actually has, by combining (a) the fraction of planned data
 * sources that are connected and (b) the average confidence the other
 * analyzers ended up with as a result.
 *
 * Weight is 0 — it doesn't compete for a share of the Decision Score; the
 * orchestrator (decisionEngine.ts) instead uses its score directly to
 * shrink the overall score toward the neutral prior when confidence is low.
 * That's why it takes the other factors' results as an argument rather
 * than fitting the plain Analyzer interface.
 */
export function confidenceAnalyzer(
  ctx: AnalyzerContext,
  substantiveFactors: DecisionFactorResult[]
): DecisionFactorResult {
  const { dataSources } = ctx;
  const connectedSources = dataSources.filter((s) => s.status === "ok").length;
  const sourceCompleteness = dataSources.length > 0 ? connectedSources / dataSources.length : 0;

  const avgFactorConfidence =
    substantiveFactors.length > 0
      ? substantiveFactors.reduce((sum, f) => sum + f.confidence, 0) / substantiveFactors.length
      : 0;

  // Equal blend of "how many sources are connected" and "how confident that
  // made the other analyzers" — the two are correlated but not identical
  // (one connected source can still leave several analyzers unconfident).
  const combined = sourceCompleteness * 0.5 + avgFactorConfidence * 0.5;
  const score = Math.round(combined * 100);
  const status = score >= 70 ? "High" : score >= 40 ? "Moderate" : "Low";

  const missingData = dataSources.filter((s) => s.status !== "ok").map((s) => s.name);

  return {
    id: ID,
    label: LABEL,
    weight: 0,
    score,
    confidence: 1,
    status,
    explanation: `${connectedSources} of ${dataSources.length} planned data sources are connected. Overall confidence in this analysis is ${status.toLowerCase()} (${score}%).`,
    supportingData: {
      connectedSources,
      totalSources: dataSources.length,
      avgFactorConfidence: Math.round(avgFactorConfidence * 100) / 100,
    },
    missingData,
  };
}
