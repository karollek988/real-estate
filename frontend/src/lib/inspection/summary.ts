import type { Translator } from "@/i18n/translator";
import type { AnalysisReport } from "@/lib/analysis/types";
import { buildBrokerQuestions, buildBrfQuestions, type DataGap } from "./gaps";
import { ROOMS, type ChecklistState, type InspectionSummary, type Observation } from "./types";

/**
 * PART 9: generates the after-inspection summary from what the customer
 * actually recorded during the walkthrough (checklist + observations) plus
 * whatever documentation gaps are still open — a neutral, professional
 * tone, no invented findings. `t` is the translator of the "inspection"
 * messages, so the summary is written in the reader's language.
 */
export function buildInspectionSummary(
  report: AnalysisReport,
  checklist: ChecklistState,
  observations: Observation[],
  gaps: DataGap[],
  t: Translator,
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
      const roomName: string = t(`rooms.${room.id}.label`);
      const checkpointName: string = t(`rooms.${room.id}.checkpoints.${checkpoint.id}`);
      if (state.severity === "major") {
        majorCount++;
        weaknesses.push(
          state.notes
            ? t("summary.major", { room: roomName, checkpoint: checkpointName, note: state.notes })
            : t("summary.majorNoNote", { room: roomName, checkpoint: checkpointName }),
        );
        futureCosts.push(t("summary.possibleAction", { room: roomName.toLowerCase(), checkpoint: checkpointName.toLowerCase() }));
      } else if (state.severity === "minor") {
        minorCount++;
        weaknesses.push(
          state.notes
            ? t("summary.minor", { room: roomName, checkpoint: checkpointName, note: state.notes })
            : t("summary.minorNoNote", { room: roomName, checkpoint: checkpointName }),
        );
      } else {
        okCount++;
      }
    }
  }

  if (okCount > 0) {
    strengths.push(t("summary.okPoints", { count: okCount }));
  }
  if (majorCount === 0 && minorCount === 0 && okCount > 0) {
    strengths.push(t("summary.noRemarks"));
  }

  for (const observation of observations) {
    weaknesses.push(t("summary.ownObservation", { text: observation.text }));
  }

  const missingDocumentation = gaps.filter((g) => g.missing).map((g) => t(`gaps.${g.id}`) as string);
  const openQuestions = [...buildBrokerQuestions(report, gaps, t), ...buildBrfQuestions(report, gaps, t)];

  const followUp: string[] = [];
  if (majorCount > 0) {
    followUp.push(t("summary.followUp.major"));
  }
  if (minorCount > 0) {
    followUp.push(t("summary.followUp.minor"));
  }
  if (missingDocumentation.length > 0) {
    followUp.push(t("summary.followUp.missing"));
  }
  if (followUp.length === 0) {
    followUp.push(t("summary.followUp.none"));
  }

  let overallRecommendation: string;
  if (majorCount > 0) {
    overallRecommendation = t("summary.overall.major");
  } else if (minorCount > 2 || missingDocumentation.length > 2) {
    overallRecommendation = t("summary.overall.several");
  } else if (minorCount > 0 || missingDocumentation.length > 0) {
    overallRecommendation = t("summary.overall.few");
  } else if (okCount > 0) {
    overallRecommendation = t("summary.overall.clean");
  } else {
    overallRecommendation = t("summary.overall.notDone");
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
