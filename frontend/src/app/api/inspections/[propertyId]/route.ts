import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { localeOfRequest } from "@/i18n/requestLocale";
import { requireUser } from "@/lib/auth/requireUser";
import { hasFullEntitlementForProperty } from "@/lib/analysis/ownership";
import { findPropertyById, latestCompleteAnalysis } from "@/lib/analysis/store";
import {
  createInspection,
  findInspection,
  listDocuments,
  listPhotos,
  updateInspection,
  type InspectionPatch,
} from "@/lib/inspection/store";
import { buildDataGaps, buildBrfQuestions, buildBrokerQuestions } from "@/lib/inspection/gaps";
import { buildInspectionSummary } from "@/lib/inspection/summary";
import { getBrfReview } from "@/lib/brf/reviews";
import { brfChapterState, formatDue } from "@/lib/report/brfChapter";
import { serverTextKit } from "@/i18n/serverTextKit";
import type { AppLocale } from "@/i18n/locales";
import type { AnalysisReport } from "@/lib/analysis/types";
import { apiError } from "@/i18n/apiText";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Confirms the caller owns the full analysis (Trygghetspaketet) of this
 * property and returns its latest complete full analysis, which the viewing
 * guide reads from (PART 5). The guide builds on the whole report — the
 * listing facts, the housing association, the risks — so an area-only
 * analysis does not qualify.
 */
async function requireOwnedProperty(userId: string, propertyId: string) {
  const property = await findPropertyById(propertyId);
  if (!property) return { error: errorResponse(404, "not_found", "No property with that id.") };

  if (!(await hasFullEntitlementForProperty(userId, propertyId))) {
    return {
      error: await apiError(403, "analysis_required", "inspections.guideIncluded"),
    };
  }

  const analysis = await latestCompleteAnalysis(propertyId);
  if (!analysis || !analysis.report) {
    return { error: await apiError(409, "analysis_incomplete", "inspections.analysisIncomplete") };
  }

  return { property, analysis };
}

/** GET /api/inspections/:propertyId — fetch-or-create the caller's inspection for this property. */
export async function GET(request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const gate = await requireOwnedProperty(user.id, propertyId);
  if ("error" in gate) return gate.error;
  const { property, analysis } = gate;
  const report = analysis.report!;

  let inspection = await findInspection(user.id, propertyId);
  if (!inspection) {
    inspection = await createInspection(user.id, propertyId, analysis.id);
  }

  const [documents, photos] = await Promise.all([
    listDocuments(inspection.id),
    listPhotos(inspection.id),
  ]);

  // The questions and the summary are written for whoever reads them: in the language of the page.
  const locale = localeOfRequest(request);
  const t = await getTranslations({ locale, namespace: "inspection" });
  const gaps = buildDataGaps(report, property.attributes, documents);
  const brf = await brfForGuide(report, propertyId, locale);
  // A summary made earlier is written again from what was recorded, so it is in this page's language.
  const summary = inspection.summary
    ? { ...buildInspectionSummary(report, inspection.checklist, inspection.observations, gaps, t), generatedAt: inspection.summary.generatedAt }
    : null;

  return NextResponse.json({
    inspection: { ...inspection, summary },
    documents,
    photos,
    gaps,
    brokerQuestions: buildBrokerQuestions(report, gaps, t),
    // The reviewed BRF analysis's own questions come first once it is published.
    brfQuestions: Array.from(new Set([...brf.questions, ...buildBrfQuestions(report, gaps, t)])),
    property: { id: property.id, address: property.address, attributes: property.attributes },
    report: { property: report.property },
    brf: { status: brf.status, concerns: brf.concerns, dueLabel: brf.dueLabel },
  });
}

/**
 * What the viewing guide shows about the association: the points the
 * reviewed BRF analysis flags, or when it will be ready. Never the automatic
 * extraction — the BRF analysis reaches a customer only through the review.
 */
async function brfForGuide(report: AnalysisReport, propertyId: string, locale: AppLocale) {
  const kit = await serverTextKit(locale);
  const review = await getBrfReview(propertyId).catch(() => null);
  const state = brfChapterState(
    report,
    review
      ? {
          status: review.status,
          figures: review.published,
          publishedAt: review.publishedAt,
          dueAt: review.status === "pending" ? review.dueAt : null,
          documentReceived: review.brfReportId !== null,
        }
      : null,
    kit,
  );
  if (state.kind === "published") {
    return { status: "published" as const, concerns: state.reading.concerns, questions: state.reading.questions, dueLabel: null };
  }
  if (state.kind === "awaiting") {
    return { status: "awaiting" as const, concerns: [], questions: [], dueLabel: state.overdue ? null : formatDue(state.dueAt, kit) };
  }
  return { status: "none" as const, concerns: [], questions: [], dueLabel: null };
}

/** PATCH /api/inspections/:propertyId — autosave partial inspection state (step, checklist, notes, ...). */
export async function PATCH(request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const gate = await requireOwnedProperty(user.id, propertyId);
  if ("error" in gate) return gate.error;

  const existing = await findInspection(user.id, propertyId);
  if (!existing) return errorResponse(404, "not_found", "No inspection to update yet — GET first.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse(400, "invalid_request", "Invalid request body.");
  }

  const patch = body as InspectionPatch & { requestSummary?: boolean };
  const { requestSummary, ...rest } = patch;

  let updated = await updateInspection(existing.id, rest);

  if (requestSummary) {
    const analysis = await latestCompleteAnalysis(propertyId);
    const property = await findPropertyById(propertyId);
    if (analysis?.report && property) {
      const documents = await listDocuments(existing.id);
      const gaps = buildDataGaps(analysis.report, property.attributes, documents);
      const t = await getTranslations({ locale: localeOfRequest(request), namespace: "inspection" });
      const summary = buildInspectionSummary(analysis.report, updated.checklist, updated.observations, gaps, t);
      updated = await updateInspection(existing.id, { summary, status: "complete", step: 3 });
    }
  }

  return NextResponse.json({ inspection: updated });
}
