import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { findPremiumAnalysisForProperty } from "@/lib/analysis/ownership";
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

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Confirms the caller has a Premium analysis for this property (the gate
 * for Besiktningshjälp) and returns the property's latest complete analysis,
 * which the inspection reads from (PART 5).
 */
async function requirePremiumProperty(userId: string, propertyId: string) {
  const property = await findPropertyById(propertyId);
  if (!property) return { error: errorResponse(404, "not_found", "No property with that id.") };

  const premium = await findPremiumAnalysisForProperty(userId, propertyId);
  if (!premium) {
    return {
      error: errorResponse(
        403,
        "premium_required",
        "Besiktningshjälp kräver en Premium-analys för den här bostaden."
      ),
    };
  }

  const analysis = await latestCompleteAnalysis(propertyId);
  if (!analysis || !analysis.report) {
    return { error: errorResponse(409, "analysis_incomplete", "Analysen är inte klar än.") };
  }

  return { property, analysis };
}

/** GET /api/inspections/:propertyId — fetch-or-create the caller's inspection for this property. */
export async function GET(_request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const gate = await requirePremiumProperty(user.id, propertyId);
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

  const gaps = buildDataGaps(report, property.attributes, documents);

  return NextResponse.json({
    inspection,
    documents,
    photos,
    gaps,
    brokerQuestions: buildBrokerQuestions(report, gaps),
    brfQuestions: buildBrfQuestions(report, gaps),
    property: { id: property.id, address: property.address, attributes: property.attributes },
    report: {
      decisionScore: report.decisionScore,
      verdict: report.verdict,
      summary: report.summary,
      property: report.property,
      decisionFactors: report.decisionFactors,
    },
  });
}

/** PATCH /api/inspections/:propertyId — autosave partial inspection state (step, checklist, notes, ...). */
export async function PATCH(request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const gate = await requirePremiumProperty(user.id, propertyId);
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
      const summary = buildInspectionSummary(analysis.report, updated.checklist, updated.observations, gaps);
      updated = await updateInspection(existing.id, { summary, status: "complete", step: 3 });
    }
  }

  return NextResponse.json({ inspection: updated });
}
