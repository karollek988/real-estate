import { getAnalysisWithProperty } from "./store";
import { getAnalysisRequestRow, type AnalysisType } from "./ownership";
import { redactAnalysisReport, type LockedSectionId } from "./redact";
import type { AnalysisRecord, PropertyRecord } from "./types";

/**
 * The single server-only entry point for "what can this viewer see of this
 * analysis" — used by both the JSON API route and the report page, so there
 * is exactly one place that resolves entitlement and exactly one place that
 * redacts the report accordingly (see redact.ts for why redaction happens
 * upstream of lib/report/build.ts).
 */

export interface ReportAccess {
  /** null when the viewer has no analysis_requests row for this analysis at all
   *  (anonymous visitor, a different user, or an old/shared link). */
  analysisType: AnalysisType | null;
  unlocked: boolean;
  fullAccess: boolean;
}

export async function resolveReportAccess(userId: string | null, analysisId: string): Promise<ReportAccess> {
  const row = userId ? await getAnalysisRequestRow(userId, analysisId) : null;
  if (!row) return { analysisType: null, unlocked: false, fullAccess: false };
  const fullAccess = row.analysisType === "premium" && row.unlocked;
  return { analysisType: row.analysisType, unlocked: row.unlocked, fullAccess };
}

export async function getReportForViewer(
  analysisId: string,
  userId: string | null
): Promise<{
  analysis: AnalysisRecord;
  property: PropertyRecord;
  access: ReportAccess;
  lockedSections: LockedSectionId[];
} | null> {
  const found = await getAnalysisWithProperty(analysisId);
  if (!found) return null;

  const access = await resolveReportAccess(userId, analysisId);

  if (!found.analysis.report) {
    return { analysis: found.analysis, property: found.property, access, lockedSections: [] };
  }

  const { report, lockedSections } = redactAnalysisReport(found.analysis.report, access.fullAccess);
  return {
    analysis: { ...found.analysis, report },
    property: found.property,
    access,
    lockedSections,
  };
}
