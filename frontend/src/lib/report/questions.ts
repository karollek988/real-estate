import type { AnalysisReport } from "@/lib/analysis/types";
import type { BrfChapterState } from "./brfChapter";
import { dateSv } from "./format";
import { tenureOf } from "./tenure";
// Runtime imports are relative (build.verify.mjs runs this through tsx).

/**
 * The report's last chapter, "Frågor inför visningen": what to ask the
 * broker and the association, built from what the listing and the BRF
 * analysis leave open — plus a plain list of what the report does not cover.
 * Questions only; the report never tells the buyer what to do.
 */
export interface QuestionsContent {
  broker: string[];
  /** Empty for a home without an association. */
  association: string[];
  /** Shown under the association questions while the BRF analysis is still being reviewed. */
  associationNote: string | null;
  notCovered: string[];
}

export function buildQuestions(report: AnalysisReport, brf: BrfChapterState): QuestionsContent {
  const p = report.property;
  const tenure = tenureOf(p);
  const hasAssociation = brf.kind === "awaiting" || brf.kind === "published";

  const broker: string[] = ["Finns det kända fel eller brister i bostaden som inte framgår av annonsen?"];
  if (hasAssociation) {
    broker.push(
      p.monthlyFeeSek !== null
        ? "Vad ingår i månadsavgiften — till exempel värme, vatten, el eller bredband?"
        : "Vad är månadsavgiften, och vad ingår i den?"
    );
    broker.push("Vem betalar överlåtelseavgiften och pantsättningsavgiften enligt föreningens stadgar?");
  }
  if (tenure === "freehold") {
    broker.push("Finns det en överlåtelsebesiktning, och vad visade den?");
    broker.push("Hur många pantbrev finns redan uttagna i fastigheten, och till vilket belopp?");
  }
  if (p.operatingCostsSek === null) {
    broker.push("Vad är driftskostnaden per år för el, värme, vatten och försäkring?");
  }
  if (p.energyClass === null) {
    broker.push("Finns det en giltig energideklaration, och vilken energiklass har huset?");
  }
  if (p.buildingYear === null) {
    broker.push("Vilket år byggdes huset, och när gjordes den senaste större renoveringen?");
  }
  if (p.previousSaleDate) {
    broker.push(`Bostaden såldes senast ${dateSv(p.previousSaleDate)} — vad har gjorts med den sedan dess?`);
  }
  broker.push("Varför säljs bostaden?");

  let association: string[] = [];
  let associationNote: string | null = null;
  if (brf.kind === "published") {
    association = brf.reading.questions;
  } else if (brf.kind === "awaiting") {
    association = [
      "Finns det planerade renoveringar, till exempel stambyte, eller beslutade avgiftshöjningar de kommande åren?",
      "Hur ser föreningens lån ut — vilken ränta, och när ska lånen omförhandlas?",
      "Finns det en aktuell underhållsplan?",
    ];
    associationNote = "Frågor anpassade efter just den här föreningens ekonomi visas här när BRF-analysen är granskad.";
  }

  const notCovered = [
    "Bostadens skick är inte besiktigat — rapporten ersätter inte en besiktning.",
    "Ditt eget lånelöfte och din privatekonomi ingår inte.",
    "Rapporten bedömer inte vad bostaden är värd eller vad den kommer att säljas för.",
    "Boendekalkylen med samtliga kostnader vid köpet lanseras inom kort.",
  ];

  return { broker, association, associationNote, notCovered };
}
