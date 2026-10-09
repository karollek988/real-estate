import type { AnalysisRecord, AnalysisScope } from "./types";

/**
 * A full report (Trygghetspaket) reaches its customer only after a Köpanalys
 * reviewer has read it and released it (analyses.released_at). Until then the
 * customer gets a page that says it is being reviewed, and nothing of the
 * report: not on the page, not through the JSON API, not as a PDF, not in the
 * viewing guide. A reviewer sees every report, released or not.
 *
 * The standalone Områdesanalys is automatic and is never held. Whether a
 * viewer is held is decided in one place, access.ts's getReportForViewer; the
 * decision itself lives here so release.verify.mjs can check it without a
 * database.
 */

/**
 * True when this viewer would see the whole report of a finished analysis but
 * no reviewer has released it yet. `viewScope` is what the viewer is entitled
 * to see of this analysis (access.ts's resolveViewScope): an area-only viewer
 * of a full analysis sees the automatic area chapter and is not held.
 */
export function isHeldForReview(
  analysis: Pick<AnalysisRecord, "scope" | "status" | "releasedAt">,
  viewScope: AnalysisScope
): boolean {
  return (
    viewScope === "full" &&
    analysis.scope === "full" &&
    analysis.status === "complete" &&
    analysis.releasedAt === null
  );
}

/** The analysis record with its content taken out: all a customer gets while the report waits for review. */
export function withoutContent(analysis: AnalysisRecord): AnalysisRecord {
  return { ...analysis, report: null, dataSources: [] };
}
