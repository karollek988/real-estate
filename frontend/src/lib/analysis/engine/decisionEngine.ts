import type { DecisionFactorResult } from "../types";
import type { AnalyzerContext } from "./analyzers/types";
import { substantiveAnalyzers } from "./analyzers/registry";
import { confidenceAnalyzer } from "./analyzers/confidence";
import { clamp } from "./helpers";

export interface DecisionEngineResult {
  /** The 7 substantive analyzers plus Confidence, in that order. */
  factors: DecisionFactorResult[];
  overallScore: number;
  /** 0-1 — see analyzers/confidence.ts. */
  overallConfidence: number;
  verdict: string;
}

// Report-facing text (the report itself is Swedish) — thresholds/logic below
// are unchanged. Labels classify the aggregate score itself, never a buy/
// avoid/caution recommendation (Köpanalys reports data, not advice).
const VERDICTS: Array<{ min: number; verdict: string }> = [
  { min: 80, verdict: "Högt sammanvägt beslutsbetyg" },
  { min: 65, verdict: "Måttligt till högt beslutsbetyg" },
  { min: 45, verdict: "Blandat beslutsbetyg" },
  { min: 0, verdict: "Lågt beslutsbetyg" },
];

/**
 * Runs every analyzer and combines their results into one Decision Score.
 *
 * Each scoreable substantive factor contributes to a weighted average,
 * discounted by its own confidence (an analyzer that's unsure sways the
 * total less than one backed by real, connected data). The result is then
 * shrunk toward the neutral prior (50) in proportion to the Confidence
 * analyzer's overall score — this is what replaces a hardcoded "cap the
 * score while data is missing" rule with a continuous function of actual,
 * measured confidence: as more real sources connect, both the raw score and
 * the confidence that lets it move away from neutral increase together.
 */
export function runDecisionEngine(ctx: AnalyzerContext): DecisionEngineResult {
  const substantive = substantiveAnalyzers.map((analyzer) => analyzer.analyze(ctx));
  const confidence = confidenceAnalyzer(ctx, substantive);
  const factors = [...substantive, confidence];

  let weightedSum = 0;
  let weightTotal = 0;
  for (const factor of substantive) {
    if (factor.score === null) continue;
    const effectiveWeight = factor.weight * factor.confidence;
    weightedSum += factor.score * effectiveWeight;
    weightTotal += effectiveWeight;
  }
  const rawScore = weightTotal > 0 ? weightedSum / weightTotal : 50;

  const overallConfidence = clamp((confidence.score ?? 0) / 100, 0, 1);
  const finalScore = Math.round(clamp(50 + (rawScore - 50) * overallConfidence, 0, 100));

  const verdict = VERDICTS.find((v) => finalScore >= v.min)!.verdict;

  return { factors, overallScore: finalScore, overallConfidence, verdict };
}
