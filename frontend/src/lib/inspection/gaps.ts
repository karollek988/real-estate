import type { Translator } from "@/i18n/translator";
import type { AnalysisReport } from "@/lib/analysis/types";
import type { DocumentType, InspectionDocument } from "./types";

/**
 * A single "the analysis already knows X" / "X is missing, upload it" signal
 * shown in the Before-Inspection step. Derived read-only from the existing
 * AnalysisReport plus whatever the customer has uploaded to this inspection
 * so far — never written back to the analysis itself.
 */
export interface DataGap {
  /** Also names the gap's label: inspection.gaps.<id> */
  id: "brf_identity" | "annual_report" | "maintenance_history" | "energy_declaration" | "parking" | "bylaws";
  /** What the analysis already knows, when it knows a value of its own (the association's name, an energy class). */
  knownValue: string | null;
  /** What it knows when there is no value to show, only that it is so: written out in inspection.gaps.known.<code>. */
  known: "available" | "uploaded" | "parkingExists" | "garageExists" | "noParking" | null;
  missing: boolean;
  /** Which document upload would close this gap, if any. */
  resolvableByDocType: DocumentType | null;
}

function hasDoc(documents: InspectionDocument[], type: DocumentType): boolean {
  return documents.some((d) => d.docType === type);
}

/**
 * PART 5: "If the analysis already knows something show it. If information
 * is missing highlight it" — with an upload affordance for anything that a
 * document could plausibly supply.
 */
export function buildDataGaps(
  report: AnalysisReport,
  attributes: Record<string, unknown>,
  documents: InspectionDocument[]
): DataGap[] {
  const gaps: DataGap[] = [];

  const brfName = report.property.housingAssociation;
  gaps.push({
    id: "brf_identity",
    knownValue: brfName,
    known: null,
    missing: brfName === null,
    resolvableByDocType: null,
  });

  const hasAnnualReportAttribute =
    attributes.brf_annual_report !== undefined && attributes.brf_annual_report !== null;
  const annualReportUploaded = hasAnnualReportAttribute || hasDoc(documents, "annual_report");
  gaps.push({
    id: "annual_report",
    knownValue: null,
    known: annualReportUploaded ? "available" : null,
    missing: !annualReportUploaded,
    resolvableByDocType: "annual_report",
  });

  // No provider in the analysis engine populates a maintenance history today
  // (confirmed: no such field exists on AnalysisReport or PropertyRecord) —
  // this gap can only ever be closed by the customer uploading one.
  const maintenancePlanUploaded = hasDoc(documents, "maintenance_plan");
  gaps.push({
    id: "maintenance_history",
    knownValue: null,
    known: maintenancePlanUploaded ? "uploaded" : null,
    missing: !maintenancePlanUploaded,
    resolvableByDocType: "maintenance_plan",
  });

  const energyClass = report.property.energyClass;
  const energyDeclarationUploaded = energyClass !== null || hasDoc(documents, "energy_declaration");
  gaps.push({
    id: "energy_declaration",
    knownValue: energyClass,
    known: null,
    missing: !energyDeclarationUploaded,
    resolvableByDocType: "energy_declaration",
  });

  const parkingKnown = report.property.parking === true || report.property.garage === true;
  const parkingDocumented = parkingKnown || hasDoc(documents, "other");
  gaps.push({
    id: "parking",
    knownValue: null,
    known:
      report.property.parking === true
        ? "parkingExists"
        : report.property.garage === true
          ? "garageExists"
          : report.property.parking === false && report.property.garage === false
            ? "noParking"
            : null,
    missing: !parkingDocumented && report.property.parking === null && report.property.garage === null,
    resolvableByDocType: null,
  });

  const bylawsUploaded = hasDoc(documents, "bylaws");
  gaps.push({
    id: "bylaws",
    knownValue: null,
    known: bylawsUploaded ? "uploaded" : null,
    missing: !bylawsUploaded,
    resolvableByDocType: "bylaws",
  });

  return gaps;
}

/**
 * Broker-facing questions, seeded from whatever gaps/risks the analysis already surfaced. `t` is the translator of
 * the "inspection" messages: the questions are written in the reader's language.
 */
export function buildBrokerQuestions(report: AnalysisReport, gaps: DataGap[], t: Translator): string[] {
  const questions: string[] = [];
  if (gaps.find((g) => g.id === "annual_report")?.missing) {
    questions.push(t("questions.broker.annualReport"));
  }
  if (gaps.find((g) => g.id === "maintenance_history")?.missing) {
    questions.push(t("questions.broker.maintenancePlan"));
  }
  if (gaps.find((g) => g.id === "energy_declaration")?.missing) {
    questions.push(t("questions.broker.energyDeclaration"));
  }
  if (report.property.previousSaleDate) {
    questions.push(t("questions.broker.previousSale", { date: report.property.previousSaleDate }));
  }
  questions.push(t("questions.broker.knownFaults"));
  return questions;
}

export function buildBrfQuestions(report: AnalysisReport, gaps: DataGap[], t: Translator): string[] {
  const questions: string[] = [];
  if (gaps.find((g) => g.id === "bylaws")?.missing) {
    questions.push(t("questions.brf.bylaws"));
  }
  questions.push(t("questions.brf.renovations"));
  questions.push(t("questions.brf.loans"));
  if (report.property.parking === null && report.property.garage === null) {
    questions.push(t("questions.brf.parking"));
  }
  return questions;
}
