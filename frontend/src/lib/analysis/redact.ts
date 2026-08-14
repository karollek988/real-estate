import type { AnalysisReport, DecisionFactorResult } from "./types";

/**
 * Server-side entitlement redaction. Free-tier analyses (and unpurchased
 * Premium analyses) must only ever receive Fastighetsinformation and the
 * core Prisanalys/Bostadsrättsförening facts — everything else is Premium.
 * This runs on the raw AnalysisReport, upstream of lib/report/build.ts's
 * chapter builders, so a locked chapter's builder never even sees the data
 * it would render: build.ts stays entitlement-unaware and its existing
 * .find()-based lookups degrade gracefully when a factor is simply absent.
 */

export type LockedSectionId =
  | "executiveSummary"
  | "priceComparables"
  | "priceAreaTrend"
  | "areaAnalysis"
  | "brokerDocuments"
  | "riskAssessment"
  | "investmentOutlook"
  | "finalRecommendation";

const FREE_FACTOR_IDS = new Set(["price", "housingAssociation"]);

const ALWAYS_LOCKED: LockedSectionId[] = [
  "executiveSummary",
  "areaAnalysis",
  "brokerDocuments",
  "riskAssessment",
  "investmentOutlook",
  "finalRecommendation",
];

export function redactAnalysisReport(
  full: AnalysisReport,
  fullAccess: boolean
): { report: AnalysisReport; lockedSections: LockedSectionId[] } {
  // decisionScore/verdict/overallConfidence are dropped for everyone (Part 3
  // — Köpanalys no longer scores/rates properties), not just unentitled
  // viewers. Nothing in the UI reads these anymore; kept as empty/zero
  // rather than removed from the type since the DB column/engine output is
  // unchanged and other internal code may still reference the shape.
  const base: AnalysisReport = { ...full, decisionScore: 0, verdict: "", overallConfidence: 0 };

  if (fullAccess) return { report: base, lockedSections: [] };

  const originalPrice = full.decisionFactors?.find((f) => f.id === "price");
  const hadComparables = arrayField(originalPrice?.supportingData.comparableSales).length > 0;
  const hadTrend = arrayField(originalPrice?.supportingData.areaSoldPriceTrend).length > 0;

  const decisionFactors: DecisionFactorResult[] = (full.decisionFactors ?? [])
    .filter((f) => FREE_FACTOR_IDS.has(f.id))
    .map((f) =>
      f.id === "price"
        ? { ...f, supportingData: withoutKeys(f.supportingData, ["comparableSales", "areaSoldPriceTrend"]) }
        : f
    );

  const report: AnalysisReport = {
    ...base,
    // The composed summary sentence mixes in premium-chapter facts
    // (confidence, area, market) — blank it for redacted views. Not
    // currently rendered by the report page; this is defense in depth.
    summary: "",
    // Insight.label is free Swedish prose with no source-factor id attached,
    // so there's no safe way to keep only the price/BRF ones — drop all of
    // them for redacted views rather than risk leaking a premium insight.
    insights: [],
    decisionFactors,
  };

  const lockedSections = [...ALWAYS_LOCKED];
  if (hadComparables) lockedSections.push("priceComparables");
  if (hadTrend) lockedSections.push("priceAreaTrend");

  return { report, lockedSections };
}

function arrayField(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function withoutKeys(data: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const copy = { ...data };
  for (const k of keys) delete copy[k];
  return copy;
}
