import type { AnalysisReport } from "@/lib/analysis/types";
import { buildBrokerQuestions, buildBrfQuestions, type DataGap } from "./gaps";
import { ROOMS, type ChecklistState, type InspectionSummary, type Observation } from "./types";

/**
 * PART 9: generates the after-inspection summary from what the customer
 * actually recorded during the walkthrough (checklist + observations) plus
 * whatever documentation gaps are still open — a neutral, professional
 * tone, no invented findings.
 */
export function buildInspectionSummary(
  report: AnalysisReport,
  checklist: ChecklistState,
  observations: Observation[],
  gaps: DataGap[]
): InspectionSummary {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const futureCosts: string[] = [];

  let okCount = 0;
  let minorCount = 0;
  let majorCount = 0;

  for (const room of ROOMS) {
    const roomState = checklist[room.id];
    if (!roomState) continue;
    for (const checkpoint of room.checkpoints) {
      const state = roomState[checkpoint.id];
      if (!state?.checked) continue;
      if (state.severity === "major") {
        majorCount++;
        weaknesses.push(
          `${room.label} – ${checkpoint.label}${state.notes ? `: ${state.notes}` : " uppvisar en allvarlig anmärkning."}`
        );
        futureCosts.push(`Möjlig åtgärd: ${room.label.toLowerCase()} (${checkpoint.label.toLowerCase()}).`);
      } else if (state.severity === "minor") {
        minorCount++;
        weaknesses.push(
          `${room.label} – ${checkpoint.label}${state.notes ? `: ${state.notes}` : " uppvisar en mindre anmärkning."}`
        );
      } else {
        okCount++;
      }
    }
  }

  if (okCount > 0) {
    strengths.push(`${okCount} kontrollpunkter genomgicks utan anmärkning.`);
  }
  if (majorCount === 0 && minorCount === 0 && okCount > 0) {
    strengths.push("Inga anmärkningar noterades vid genomgången.");
  }

  for (const observation of observations) {
    weaknesses.push(`Egen observation: ${observation.text}`);
  }

  const missingDocumentation = gaps.filter((g) => g.missing).map((g) => g.label);
  const openQuestions = [...buildBrokerQuestions(report, gaps), ...buildBrfQuestions(report, gaps)];

  const followUp: string[] = [];
  if (majorCount > 0) {
    followUp.push("Begär en fördjupad besiktning av en certifierad besiktningsman för de allvarliga anmärkningarna.");
  }
  if (minorCount > 0) {
    followUp.push("Be säljaren eller mäklaren kommentera de mindre anmärkningarna innan budgivning.");
  }
  if (missingDocumentation.length > 0) {
    followUp.push("Komplettera saknad dokumentation innan slutgiltigt beslut.");
  }
  if (followUp.length === 0) {
    followUp.push("Inga särskilda uppföljningspunkter utöver den ordinarie processen.");
  }

  let overallRecommendation: string;
  if (majorCount > 0) {
    overallRecommendation =
      "Allvarliga anmärkningar noterades. Vi rekommenderar en fördjupad besiktning innan bud läggs, och att kostnaderna för åtgärder vägs in i budgivningen.";
  } else if (minorCount > 2 || missingDocumentation.length > 2) {
    overallRecommendation =
      "Inga allvarliga anmärkningar, men flera mindre punkter och/eller saknad dokumentation bör klargöras innan ett slutgiltigt beslut.";
  } else if (minorCount > 0 || missingDocumentation.length > 0) {
    overallRecommendation =
      "Besiktningen visar en överlag god bild av bostaden, med ett fåtal punkter att följa upp innan köp.";
  } else if (okCount > 0) {
    overallRecommendation =
      "Besiktningen visar inga anmärkningar. Bostaden framstår som väl underhållen utifrån genomförd genomgång.";
  } else {
    overallRecommendation =
      "Besiktningen är ännu inte genomförd. Gå igenom checklistan rum för rum för att få en fullständig bedömning.";
  }

  return {
    strengths,
    weaknesses,
    futureCosts,
    followUp,
    missingDocumentation,
    openQuestions,
    overallRecommendation,
    generatedAt: new Date().toISOString(),
  };
}
