import type { AnalysisReport } from "@/lib/analysis/types";
import type { DocumentType, InspectionDocument } from "./types";

/**
 * A single "the analysis already knows X" / "X is missing, upload it" signal
 * shown in the Before-Inspection step. Derived read-only from the existing
 * AnalysisReport plus whatever the customer has uploaded to this inspection
 * so far — never written back to the analysis itself.
 */
export interface DataGap {
  id: string;
  label: string;
  /** What the analysis already knows, when it knows something. */
  knownValue: string | null;
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
    label: "Bostadsrättsförening",
    knownValue: brfName,
    missing: brfName === null,
    resolvableByDocType: null,
  });

  const hasAnnualReportAttribute =
    attributes.brf_annual_report !== undefined && attributes.brf_annual_report !== null;
  const annualReportUploaded = hasAnnualReportAttribute || hasDoc(documents, "annual_report");
  gaps.push({
    id: "annual_report",
    label: "Årsredovisning",
    knownValue: annualReportUploaded ? "Tillgänglig" : null,
    missing: !annualReportUploaded,
    resolvableByDocType: "annual_report",
  });

  // No provider in the analysis engine populates a maintenance history today
  // (confirmed: no such field exists on AnalysisReport or PropertyRecord) —
  // this gap can only ever be closed by the customer uploading one.
  const maintenancePlanUploaded = hasDoc(documents, "maintenance_plan");
  gaps.push({
    id: "maintenance_history",
    label: "Underhållshistorik",
    knownValue: maintenancePlanUploaded ? "Uppladdad" : null,
    missing: !maintenancePlanUploaded,
    resolvableByDocType: "maintenance_plan",
  });

  const energyClass = report.property.energyClass;
  const energyDeclarationUploaded = energyClass !== null || hasDoc(documents, "energy_declaration");
  gaps.push({
    id: "energy_declaration",
    label: "Energideklaration",
    knownValue: energyClass,
    missing: !energyDeclarationUploaded,
    resolvableByDocType: "energy_declaration",
  });

  const parkingKnown = report.property.parking === true || report.property.garage === true;
  const parkingDocumented = parkingKnown || hasDoc(documents, "other");
  gaps.push({
    id: "parking",
    label: "Parkering/garage",
    knownValue:
      report.property.parking === true
        ? "Parkering finns"
        : report.property.garage === true
          ? "Garage finns"
          : report.property.parking === false && report.property.garage === false
            ? "Ingen parkering angiven"
            : null,
    missing: !parkingDocumented && report.property.parking === null && report.property.garage === null,
    resolvableByDocType: null,
  });

  const bylawsUploaded = hasDoc(documents, "bylaws");
  gaps.push({
    id: "bylaws",
    label: "Stadgar",
    knownValue: bylawsUploaded ? "Uppladdad" : null,
    missing: !bylawsUploaded,
    resolvableByDocType: "bylaws",
  });

  return gaps;
}

/** Broker-facing questions, seeded from whatever gaps/risks the analysis already surfaced. */
export function buildBrokerQuestions(report: AnalysisReport, gaps: DataGap[]): string[] {
  const questions: string[] = [];
  if (gaps.find((g) => g.id === "annual_report")?.missing) {
    questions.push("Kan du skicka föreningens senaste årsredovisning?");
  }
  if (gaps.find((g) => g.id === "maintenance_history")?.missing) {
    questions.push("Finns det en underhållsplan och har den följts historiskt?");
  }
  if (gaps.find((g) => g.id === "energy_declaration")?.missing) {
    questions.push("Finns en giltig energideklaration för bostaden?");
  }
  if (report.property.previousSaleDate) {
    questions.push(`Varför säljs bostaden nu, och stämmer skicket med föregående försäljning ${report.property.previousSaleDate}?`);
  }
  questions.push("Finns kända fel eller anmärkningar som inte framgår av annonsen?");
  return questions;
}

export function buildBrfQuestions(report: AnalysisReport, gaps: DataGap[]): string[] {
  const questions: string[] = [];
  if (gaps.find((g) => g.id === "bylaws")?.missing) {
    questions.push("Kan styrelsen dela föreningens stadgar?");
  }
  questions.push("Finns planerade renoveringar eller avgiftshöjningar de kommande åren?");
  questions.push("Hur ser föreningens lån och räntebindning ut?");
  if (report.property.parking === null && report.property.garage === null) {
    questions.push("Hanterar föreningen parkering/garage, och finns kö?");
  }
  return questions;
}
