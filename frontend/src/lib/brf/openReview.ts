import { after } from "next/server";
import type { AnalysisRecord, PropertyRecord } from "@/lib/analysis/types";
import { tenureOfProperty } from "@/lib/report/tenure";
import { ensureBrfReview } from "./reviews";
import { notifyTeamOfBrfReview } from "./notify";

/**
 * Makes sure a person is going to look at what a customer has just ordered, and
 * tells the team when a new round opens.
 *
 *  - A full report that no reviewer has released yet (analyses.released_at is
 *    empty — a new one, or an older one a second customer joins) needs an open
 *    round, for a freehold home too: the whole report is reviewed, not only
 *    the housing association. A round that is already open keeps its deadline;
 *    a finished one is reopened with 24 new hours.
 *  - A report that was released earlier (a cached one) is shown at once; a
 *    home with a housing association still gets its BRF review as before.
 *
 * Never fails the request that calls it: the report page opens the round too
 * if this didn't get to.
 */
export async function openReviewForAnalysis(property: PropertyRecord, analysis: AnalysisRecord): Promise<void> {
  if (analysis.scope !== "full") return;

  const waiting = analysis.releasedAt === null;
  if (!waiting && tenureOfProperty(property) === "freehold") return;

  const reason = waiting ? "analysis" : "purchase";
  try {
    const { review, opened } = await ensureBrfReview(property.id, reason);
    if (opened) {
      after(() =>
        notifyTeamOfBrfReview(review, reason).catch((err) =>
          console.error(`Review notification failed for property ${property.id}:`, err)
        )
      );
    }
  } catch (err) {
    console.error(`Could not open the review for property ${property.id}:`, err);
  }
}
