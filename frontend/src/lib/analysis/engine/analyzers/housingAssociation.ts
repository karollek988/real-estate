import type { Analyzer } from "./types";
import type { BrfFinancialAnalysis, FindingDto, SignalStrengthDto } from "../../providers/brfFinancials";
import { insufficientDataFactor, sourceLabel, stringOrNull } from "../helpers";

const ID = "housingAssociation";
const LABEL = "Housing Association";
const WEIGHT = 0.15;

/**
 * Maps a Signal's threshold classification (calculator.py/reasoning.py's
 * judgment) onto a 0-100 display scale. This is not financial reasoning —
 * the thresholds and classification already happened in reasoning.py; this
 * is only the same kind of scale conversion the rest of the Decision Engine
 * already does (e.g. Price Analyzer's delta→score curve).
 */
const SIGNAL_STRENGTH_SCORE: Record<SignalStrengthDto, number | null> = {
  strong_positive: 100,
  positive: 80,
  weak_positive: 65,
  neutral: 50,
  weak_negative: 35,
  negative: 20,
  strong_negative: 0,
  unknown: null,
};

const SEVERITY_LABEL: Record<NonNullable<FindingDto["severity"]>, string> = {
  minor: "minor",
  moderate: "moderate",
  significant: "significant",
  critical: "critical",
};

/**
 * Reads a numeric value out of `attributes.brf_annual_report` — the raw
 * verified annual-report JSON (providers/brfAcquisition.ts), one level
 * down from the calculated metrics this analyzer otherwise scores from.
 * Only ever reads already-VERIFIED fields (see BRF-Scraper's
 * extractor/validation.py) — never a calculation, just a pass-through of
 * a fact the parser already extracted and the pipeline already carries.
 */
function annualReportNumber(attributes: Record<string, unknown>, section: string, field: string): number | null {
  const report = attributes.brf_annual_report;
  if (!report || typeof report !== "object") return null;
  const sec = (report as Record<string, unknown>)[section];
  if (!sec || typeof sec !== "object") return null;
  const entry = (sec as Record<string, unknown>)[field];
  if (!entry || typeof entry !== "object") return null;
  const value = (entry as Record<string, unknown>).value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function scoreFromFinancialAnalysis(
  analysis: BrfFinancialAnalysis,
  attributes: Record<string, unknown>
): {
  score: number | null;
  status: string;
  explanation: string;
  supportingData: Record<string, unknown>;
} {
  const { metrics, reasoning } = analysis;

  const scored = reasoning.signals
    .map((s) => SIGNAL_STRENGTH_SCORE[s.strength])
    .filter((v): v is number => v !== null);
  const score = scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  const strengths = reasoning.findings.filter((f) => f.classification === "strength");
  const weaknesses = reasoning.findings.filter((f) => f.classification === "weakness");
  const critical = weaknesses.filter((f) => f.severity === "critical");
  const significant = weaknesses.filter((f) => f.severity === "significant");

  const status =
    score === null
      ? "Insufficient data"
      : score >= 80
        ? "Strong finances"
        : score >= 60
          ? "Healthy finances"
          : score >= 40
            ? "Mixed finances"
            : score >= 20
              ? "Weak finances"
              : "Critical finances";

  const weaknessDetail =
    weaknesses.length > 0
      ? ` ${weaknesses.length} weakness(es) found (${weaknesses
          .map((f) => `${f.dimension.replace(/_/g, " ")}: ${f.severity ? SEVERITY_LABEL[f.severity] : "minor"}`)
          .join(", ")}).`
      : "";
  const explanation =
    `Financial analysis of the association's ${metrics.fiscalYear} annual report found ` +
    `${strengths.length} strength(s) and ${weaknesses.length} weakness(es) across financial health, ` +
    `debt sustainability, fee sustainability, and liquidity` +
    `${critical.length > 0 ? ` (${critical.length} critical)` : significant.length > 0 ? ` (${significant.length} significant)` : ""}.` +
    weaknessDetail;

  const supportingData: Record<string, unknown> = {
    fiscalYear: metrics.fiscalYear,
    equityRatio: metrics.equityRatio?.value ?? null,
    operatingMargin: metrics.operatingMargin?.value ?? null,
    debtPerApartment: metrics.debtPerApartment?.value ?? null,
    feeSustainability: metrics.feeSustainability?.value ?? null,
    liquidityMonths: metrics.liquidityMonths?.value ?? null,
    // Already computed by calculate_metrics() (analysis_engine/calculator.py)
    // and already serialized on this same DTO — previously dropped here
    // rather than never calculated.
    debtRatio: metrics.debtRatio?.value ?? null,
    debtToEquity: metrics.debtToEquity?.value ?? null,
    totalDebt: metrics.totalDebt?.value ?? null,
    weightedAverageInterest: metrics.weightedAverageInterest?.value ?? null,
    shortTermDebtRatio: metrics.shortTermDebtRatio?.value ?? null,
    costPerSqm: metrics.costPerSqm?.value ?? null,
    findings: reasoning.findings.map((f) => ({
      dimension: f.dimension,
      classification: f.classification,
      severity: f.severity,
      summary: f.summary,
    })),
  };

  // Already-verified apartment-mix facts from the same annual report
  // (providers/brfAcquisition.ts sets `attributes.brf_annual_report`
  // upstream of this analyzer) — parsed by financial_extractor.py's
  // APARTMENT_FIELDS but never previously read past the raw JSON.
  const numberOfRental = annualReportNumber(attributes, "apartment_metrics", "number_of_rental");
  const numberOfCommercial = annualReportNumber(attributes, "apartment_metrics", "number_of_commercial");
  const parkingSpaces = annualReportNumber(attributes, "apartment_metrics", "parking_spaces");
  const garageSpaces = annualReportNumber(attributes, "apartment_metrics", "garage_spaces");
  if (numberOfRental !== null) supportingData.numberOfRentalApartments = numberOfRental;
  if (numberOfCommercial !== null) supportingData.numberOfCommercialUnits = numberOfCommercial;
  if (parkingSpaces !== null) supportingData.parkingSpaces = parkingSpaces;
  if (garageSpaces !== null) supportingData.garageSpaces = garageSpaces;

  return { score, status, explanation, supportingData };
}

/**
 * Housing Association Analyzer — is the BRF financially healthy?
 *
 * Real today: the BRF's name, when Booli supplies it (identity, not
 * financial health — only affects confidence, never the score); and, when
 * `attributes.brf_financial_analysis` is set (by providers/brfFinancials.ts,
 * which bridges analysis_engine's calculator.py/reasoning.py), a real score
 * derived from that association's actual annual-report financials.
 *
 * Forward contract still open: `attributes.brf_annual_report` — the raw
 * verified annual-report JSON brfFinancials.ts needs as input — has no live
 * source yet (Bolagsverket org-number matching is unsolved, see
 * providers/brfFinancials.ts). Until then this analyzer correctly reports
 * insufficient data rather than guessing.
 */
export const housingAssociationAnalyzer: Analyzer = {
  id: ID,
  label: LABEL,
  weight: WEIGHT,

  analyze({ attributes, dataSources }) {
    const brfName = stringOrNull(attributes.housing_association);
    const financialAnalysis = attributes.brf_financial_analysis as BrfFinancialAnalysis | undefined;

    if (financialAnalysis && financialAnalysis.status === "insufficient_verified_data") {
      // An annual report WAS found and extracted — this is not the same
      // "nothing connected" situation as the fallback below, and must say
      // so: the data existed but failed validation (see
      // BRF-Scraper/src/brf_scraper/extractor/validation.py), so
      // fabricating a score from it would risk misleading the customer.
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: 0.15,
        status: "Insufficient verified data",
        explanation: brfName
          ? `${brfName}: an annual report was found, but the extracted financial figures did not pass ` +
            `validation (implausible values, a broken balance-sheet identity, or low-confidence matches) ` +
            `and were discarded rather than risk showing incorrect numbers.`
          : "An annual report was found, but the extracted financial figures did not pass validation and " +
            "were discarded rather than risk showing incorrect numbers.",
        supportingData: brfName ? { housingAssociation: brfName } : {},
        missingData: [sourceLabel(dataSources, "brf_financials")],
      });
    }

    if (financialAnalysis) {
      const { score, status, explanation, supportingData } = scoreFromFinancialAnalysis(financialAnalysis, attributes);
      if (score !== null) {
        return {
          id: ID,
          label: LABEL,
          weight: WEIGHT,
          score,
          confidence: financialAnalysis.reasoning.overallConfidence,
          status,
          explanation: brfName ? `${brfName}: ${explanation}` : explanation,
          supportingData: brfName ? { housingAssociation: brfName, ...supportingData } : supportingData,
          missingData: [],
        };
      }
    }

    const debtPerM2 = attributes.brf_debt_per_m2_sek;

    if (debtPerM2 === undefined) {
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: brfName ? 0.2 : 0.05,
        status: brfName ? "BRF identified" : "No BRF data",
        explanation: brfName
          ? `The housing association (${brfName}) is identified, but its financial health (debt, fees, reserves) isn't available — that requires Bolagsverket annual-report data, which isn't connected yet.`
          : "No housing association has been identified for this property yet, and financial health data (Bolagsverket) isn't connected.",
        supportingData: brfName ? { housingAssociation: brfName } : {},
        missingData: [
          sourceLabel(dataSources, "brf_financials"),
          sourceLabel(dataSources, "brf_register"),
        ],
      });
    }

    // Not reachable until a Bolagsverket provider is connected.
    return insufficientDataFactor({
      id: ID,
      label: LABEL,
      weight: WEIGHT,
      confidence: 0.1,
      explanation: "Housing association financial scoring is not yet implemented.",
      missingData: [],
    });
  },
};
