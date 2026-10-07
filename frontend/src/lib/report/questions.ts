import type { AnalysisReport } from "@/lib/analysis/types";
import type { BrfChapterState } from "./brfChapter";
import { createFormat } from "./format";
import { tenureOf } from "./tenure";
import type { TextKit } from "../../i18n/textKit";
// Runtime imports are relative (build.verify.mjs runs this through tsx).

/**
 * The report's last chapter, "Frågor inför visningen": what to ask the
 * broker and the association, built from what the listing and the BRF
 * analysis leave open — plus a plain list of what the report does not cover.
 * Questions only; the report never tells the buyer what to do. Every question
 * is a message (messages/<language>/report.ts, under "report.questions").
 */
export interface QuestionsContent {
  broker: string[];
  /** Empty for a home without an association. */
  association: string[];
  /** Shown under the association questions while the BRF analysis is still being reviewed. */
  associationNote: string | null;
  notCovered: string[];
}

export function buildQuestions(report: AnalysisReport, brf: BrfChapterState, kit: TextKit): QuestionsContent {
  const t = kit.t;
  const fx = createFormat(kit);
  const p = report.property;
  const tenure = tenureOf(p);
  const hasAssociation = brf.kind === "awaiting" || brf.kind === "published";

  const broker: string[] = [t("report.questions.brokerList.knownFaults")];
  if (hasAssociation) {
    broker.push(p.monthlyFeeSek !== null ? t("report.questions.brokerList.feeIncluded") : t("report.questions.brokerList.feeUnknown"));
    broker.push(t("report.questions.brokerList.transferFees"));
  }
  if (tenure === "freehold") {
    broker.push(t("report.questions.brokerList.inspectionReport"));
    broker.push(t("report.questions.brokerList.mortgageDeeds"));
  }
  if (p.operatingCostsSek === null) {
    broker.push(t("report.questions.brokerList.operatingCosts"));
  }
  if (p.energyClass === null) {
    broker.push(t("report.questions.brokerList.energyDeclaration"));
  }
  if (p.buildingYear === null) {
    broker.push(t("report.questions.brokerList.buildingYear"));
  }
  if (p.previousSaleDate) {
    broker.push(t("report.questions.brokerList.previousSale", { date: fx.date(p.previousSaleDate) }));
  }
  broker.push(t("report.questions.brokerList.whySelling"));

  let association: string[] = [];
  let associationNote: string | null = null;
  if (brf.kind === "published") {
    association = brf.reading.questions;
  } else if (brf.kind === "awaiting") {
    association = [
      t("report.questions.associationWaiting.renovations"),
      t("report.questions.associationWaiting.loans"),
      t("report.questions.associationWaiting.maintenancePlan"),
    ];
    associationNote = t("report.questions.associationWaiting.note");
  }

  const notCovered = [
    t("report.questions.notCoveredList.survey"),
    t("report.questions.notCoveredList.finances"),
    t("report.questions.notCoveredList.value"),
    t("report.questions.notCoveredList.housingCost"),
  ];

  return { broker, association, associationNote, notCovered };
}
