import type { ReportFactor } from "../types";
import type { AnalyzerContext } from "./analyzers/types";
import { analyzers } from "./analyzers/registry";

/**
 * Runs every fact collector and returns their factors. There is no scoring
 * step: Köpanalys does not rate or rank a property, it reports what the
 * sources say (the old "Decision Score" / verdict / confidence aggregate was
 * removed 2026-10-02 — nothing in the report showed it any more).
 */
export function collectFactors(ctx: AnalyzerContext): ReportFactor[] {
  return analyzers.map((analyzer) => analyzer.analyze(ctx));
}
