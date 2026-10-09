import { getAnalysisWithProperty } from "./store";
import { getBestEntitlementForProperty, hasRefundedRequestForAnalysis, type AnalysisType } from "./ownership";
import { redactAnalysisRecord, redactPropertyForHold, redactPropertyForScope } from "./redact";
import { isHeldForReview, withoutContent } from "./release";
import type { AnalysisRecord, AnalysisScope, PropertyRecord } from "./types";

/**
 * The single server-only entry point for "what can this viewer see of this
 * analysis" — used by both the JSON API route and the report page, so there
 * is exactly one place that resolves entitlement and exactly one place that
 * scopes the report accordingly (see redact.ts for why that happens upstream
 * of lib/report/build.ts).
 *
 * A viewer with no purchase for the analysis's property gets nothing at all:
 * there is no free or preview tier any more, so an analysis id alone — from a
 * stale link, another account, or a guess — never returns report content.
 *
 * A viewer who bought the full report gets it only once a Köpanalys reviewer
 * has released it (release.ts). Until then `access.held` is true and the
 * analysis comes back without its report — the one place that decides, so the
 * page, the JSON API and the PDF cannot disagree.
 */

export interface ReportAccess {
  /** What the viewer bought for this property. */
  entitlement: AnalysisType;
  /**
   * What they may see of *this* analysis: the lesser of what they bought and
   * what the analysis contains. An area-only analysis never renders as a full
   * report, not even for someone who also owns the full analysis of the same
   * property.
   */
  viewScope: AnalysisScope;
  /** True while a full report waits for a reviewer: the analysis carries no content and the page shows "being reviewed". */
  held: boolean;
}

export function resolveViewScope(entitlement: AnalysisType, analysisScope: AnalysisScope): AnalysisScope {
  return entitlement === "full" && analysisScope === "full" ? "full" : "area";
}

export async function getReportForViewer(
  analysisId: string,
  userId: string | null,
  options: {
    /** A Köpanalys reviewer (lib/auth/admin.ts) sees every report in full, released or not — the review console links to them. */
    isReviewer?: boolean;
  } = {}
): Promise<{
  analysis: AnalysisRecord;
  property: PropertyRecord;
  access: ReportAccess;
} | null> {
  if (!userId) return null;

  const found = await getAnalysisWithProperty(analysisId);
  if (!found) return null;

  let entitlement = options.isReviewer ? "full" : await getBestEntitlementForProperty(userId, found.property.id);
  if (!entitlement) {
    // A refunded request carries no entitlement, but its owner must still be
    // able to open the failed analysis to read why it failed. A failed
    // analysis has no report, so the least-privileged scope loses nothing.
    const ownsFailedAnalysis =
      found.analysis.status === "failed" && (await hasRefundedRequestForAnalysis(userId, found.analysis.id));
    if (!ownsFailedAnalysis) return null;
    entitlement = "area";
  }

  const viewScope = resolveViewScope(entitlement, found.analysis.scope);

  if (!options.isReviewer && isHeldForReview(found.analysis, viewScope)) {
    return {
      analysis: withoutContent(found.analysis),
      property: redactPropertyForHold(found.property),
      access: { entitlement, viewScope, held: true },
    };
  }

  return {
    analysis: redactAnalysisRecord(found.analysis, viewScope),
    property: redactPropertyForScope(found.property, viewScope),
    access: { entitlement, viewScope, held: false },
  };
}
