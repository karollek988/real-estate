import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPropertyById, updateProperty } from "@/lib/analysis/store";
import { rerunAnalysisForProperty } from "@/lib/analysis/pipeline";
import {
  BRF_REPORTS_BUCKET,
  findReusableBrfReport,
  getBrfReportById,
  insertBrfReport,
} from "@/lib/analysis/brfReports";
import { requireUser } from "@/lib/auth/requireUser";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/properties/:id/brf-report — upload a BRF annual report PDF for
 * this property ("Upload latest BRF annual report").
 *
 * Reuses an existing, non-expired report byte-for-byte identical to this
 * upload (or, when no organization_number is known, the most recent report
 * already on file for this property) instead of re-storing/re-extracting.
 * Otherwise uploads to Storage, extracts via the Python engine's
 * /api/brf-annual-report/upload (same extraction+validation pipeline the
 * automated crawler uses), and stores a new brf_annual_reports row.
 *
 * Either way, patches this property's attributes.brf_annual_report (the
 * exact slot brfFinancialsProvider already reads) and re-runs the existing
 * analysis pipeline — no analyzer/engine changes, no quota consumed (same
 * as the existing "Update analysis" button).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const property = await findPropertyById(propertyId);
  if (!property) {
    return errorResponse(404, "not_found", "No property with that id.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "invalid_request", "Request must be multipart/form-data.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse(400, "invalid_request", "Provide the PDF as \"file\".");
  }
  if (file.type && file.type !== "application/pdf") {
    return errorResponse(422, "invalid_file_type", "Only PDF files are supported.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");

  const knownOrgNumber =
    typeof property.attributes.brf === "object" &&
    property.attributes.brf !== null &&
    typeof (property.attributes.brf as Record<string, unknown>).organization_number === "string"
      ? ((property.attributes.brf as Record<string, unknown>).organization_number as string)
      : null;

  try {
    let report = await findReusableBrfReport({
      contentHash,
      organizationNumber: knownOrgNumber,
      propertyId,
    });
    const reused = report !== null;

    if (!report) {
      const apiBase = process.env.PYTHON_ENGINE_API_URL;
      if (!apiBase) {
        return errorResponse(
          503,
          "not_connected",
          "The analysis engine is not configured (set PYTHON_ENGINE_API_URL)."
        );
      }

      const extractRes = await fetch(`${apiBase.replace(/\/$/, "")}/api/brf-annual-report/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_base64: bytes.toString("base64"), filename: file.name }),
        signal: AbortSignal.timeout(60000),
        cache: "no-store",
      });
      const extractBody = await extractRes.json().catch(() => null);
      if (!extractRes.ok || !extractBody?.success) {
        return errorResponse(
          422,
          "extraction_failed",
          extractBody?.error ?? "Could not read that PDF as a BRF annual report."
        );
      }

      const storagePath = `${knownOrgNumber ?? `property-${propertyId}`}/${contentHash}.pdf`;
      const { error: uploadError } = await createAdminClient()
        .storage.from(BRF_REPORTS_BUCKET)
        .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      report = await insertBrfReport({
        organizationNumber: knownOrgNumber,
        fallbackPropertyId: knownOrgNumber ? null : propertyId,
        contentHash,
        storagePath,
        originalFilename: file.name || null,
        fiscalYear: typeof extractBody.fiscal_year === "number" ? extractBody.fiscal_year : null,
        annualReport: extractBody.annual_report,
        uploadedBy: user.id,
      });
    }

    await updateProperty(propertyId, {
      attributes: {
        ...property.attributes,
        brf_annual_report: report.annualReport,
        brf_report_id: report.id,
      },
    });

    const rerun = await rerunAnalysisForProperty(propertyId);
    if (!rerun) {
      return errorResponse(404, "not_found", "No property with that id.");
    }

    return NextResponse.json({
      brfReportId: report.id,
      reused,
      analysisId: rerun.analysis.id,
      propertyId: rerun.property.id,
      status: rerun.analysis.status,
    });
  } catch (err) {
    console.error(`POST /api/properties/${propertyId}/brf-report failed:`, err);
    return errorResponse(500, "internal_error", "Could not process the BRF annual report.");
  }
}

/** GET /api/properties/:id/brf-report — current BRF report metadata for this property's card. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await params;

  const { response: authError } = await requireUser();
  if (authError) return authError;

  const property = await findPropertyById(propertyId);
  if (!property) {
    return errorResponse(404, "not_found", "No property with that id.");
  }

  const reportId =
    typeof property.attributes.brf_report_id === "string" ? property.attributes.brf_report_id : null;
  if (!reportId) {
    return NextResponse.json({ report: null });
  }

  const report = await getBrfReportById(reportId);
  if (!report) {
    return NextResponse.json({ report: null });
  }

  return NextResponse.json({
    report: {
      id: report.id,
      originalFilename: report.originalFilename,
      fiscalYear: report.fiscalYear,
      uploadedAt: report.createdAt,
      retainUntil: report.retainUntil,
    },
  });
}
