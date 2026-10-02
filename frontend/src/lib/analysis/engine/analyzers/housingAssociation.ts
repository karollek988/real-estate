import type { Analyzer } from "./types";
import type { BrfFinancialAnalysis } from "../../providers/brfFinancials";
import { stringOrNull } from "../helpers";

/**
 * What the chapter knows about the association's annual report:
 *  - "verified": a report the buyer uploaded was read and at least one figure
 *                passed the verification gate (BRF-Scraper's
 *                extractor/validation.py) — the figures below are shown;
 *  - "unusable": a report was uploaded and read, but nothing in it was
 *                trustworthy enough to show — the chapter says so rather than
 *                show numbers it can't stand behind;
 *  - "none":     no report has been uploaded (nothing fetches them
 *                automatically) — the chapter asks for one.
 */
export type BrfReportState = "verified" | "unusable" | "none";

/**
 * Reads a numeric value out of `attributes.brf_annual_report` — the raw
 * verified annual-report JSON the buyer's upload produced
 * (api/properties/[id]/brf-report/route.ts) — one level down from the
 * calculated metrics. Only ever reads already-VERIFIED fields (see
 * BRF-Scraper's extractor/validation.py): a pass-through of a fact the parser
 * already extracted, never a calculation.
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

/**
 * Housing-association facts — the figures and the rule-based strengths and
 * weaknesses the "Bostadsrättsförening" chapter shows.
 *
 * The financial calculation and the rule-based reasoning happen once, in the
 * Python engine (analysis_engine/calculator.py + reasoning.py, bridged by
 * providers/brfFinancials.ts); this only reshapes their output for the report
 * builder. The numbers exist only if the buyer uploaded the association's
 * annual report.
 */
export const housingAssociationAnalyzer: Analyzer = {
  id: "housingAssociation",

  analyze({ attributes }) {
    const brfName = stringOrNull(attributes.housing_association);
    const analysis = attributes.brf_financial_analysis as BrfFinancialAnalysis | undefined;
    const withName = (data: Record<string, unknown>): Record<string, unknown> =>
      brfName ? { housingAssociation: brfName, ...data } : data;

    if (!analysis) {
      return { id: "housingAssociation", available: false, supportingData: withName({ reportState: "none" satisfies BrfReportState }) };
    }

    const { metrics, reasoning } = analysis;
    const metricValues = {
      equityRatio: metrics.equityRatio?.value ?? null,
      operatingMargin: metrics.operatingMargin?.value ?? null,
      debtPerApartment: metrics.debtPerApartment?.value ?? null,
      feeSustainability: metrics.feeSustainability?.value ?? null,
      liquidityMonths: metrics.liquidityMonths?.value ?? null,
      debtRatio: metrics.debtRatio?.value ?? null,
      debtToEquity: metrics.debtToEquity?.value ?? null,
      totalDebt: metrics.totalDebt?.value ?? null,
      weightedAverageInterest: metrics.weightedAverageInterest?.value ?? null,
      shortTermDebtRatio: metrics.shortTermDebtRatio?.value ?? null,
      costPerSqm: metrics.costPerSqm?.value ?? null,
    };

    const numberOfRental = annualReportNumber(attributes, "apartment_metrics", "number_of_rental");
    const numberOfCommercial = annualReportNumber(attributes, "apartment_metrics", "number_of_commercial");
    const parkingSpaces = annualReportNumber(attributes, "apartment_metrics", "parking_spaces");
    const garageSpaces = annualReportNumber(attributes, "apartment_metrics", "garage_spaces");

    const hasFigures =
      Object.values(metricValues).some((v) => v !== null) ||
      [numberOfRental, numberOfCommercial, parkingSpaces, garageSpaces].some((v) => v !== null);
    const hasSignals = reasoning.signals.some((s) => s.strength !== "unknown");

    if (!hasFigures && !hasSignals) {
      return { id: "housingAssociation", available: false, supportingData: withName({ reportState: "unusable" satisfies BrfReportState }) };
    }

    const supportingData: Record<string, unknown> = {
      reportState: "verified" satisfies BrfReportState,
      fiscalYear: metrics.fiscalYear,
      ...metricValues,
      findings: reasoning.findings.map((f) => ({
        dimension: f.dimension,
        classification: f.classification,
        severity: f.severity,
        summary: f.summary,
      })),
    };
    if (numberOfRental !== null) supportingData.numberOfRentalApartments = numberOfRental;
    if (numberOfCommercial !== null) supportingData.numberOfCommercialUnits = numberOfCommercial;
    if (parkingSpaces !== null) supportingData.parkingSpaces = parkingSpaces;
    if (garageSpaces !== null) supportingData.garageSpaces = garageSpaces;

    return { id: "housingAssociation", available: true, supportingData: withName(supportingData) };
  },
};
