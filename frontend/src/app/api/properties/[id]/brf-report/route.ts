import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPropertyById, updateProperty } from "@/lib/analysis/store";
import { rerunAnalysisForProperty } from "@/lib/analysis/pipeline";
import {
  BRF_REPORTS_BUCKET,
  MAX_BRF_REPORT_BYTES,
  classifyBrfMimeType,
  getBrfReportById,
  saveBrfReport,
} from "@/lib/analysis/brfReports";
import { hasAnyAnalysisRequestForProperty } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";
import { pythonEngineHeaders } from "@/lib/pythonEngine";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Matches the Python engine's own extraction budget (AbortSignal.timeout
// below) with headroom, and lets a large scanned report's per-page OCR
// (BRF-Scraper/src/brf_scraper/extractor/pdf_reader.py) actually finish
// instead of the function being killed mid-request. Sibling routes that
// also call the Python engine synchronously set the same ceiling (see
// api/analyses/route.ts).
export const maxDuration = 300;

/**
 * POST /api/properties/:id/brf-report — step 2 of the BRF annual-report
 * upload ("Upload latest BRF annual report"): the browser has already PUT
 * the file bytes straight into Storage via a signed URL from
 * ./upload-url/route.ts (step 1) — this route picks that object up by its
 * staging path, so it never has to accept the raw file itself and is not
 * subject to Vercel's 4.5MB request-body limit.
 *
 * Copies the staged upload to its permanent content-hash path, extracts it
 * via the Python engine's /api/brf-annual-report/upload (same
 * extraction+validation pipeline the automated crawler uses), and saves the
 * result as a brf_annual_reports row (refreshing the row if this exact file
 * was uploaded before — an upload is always read by the current engine, never
 * answered from an older stored extraction). The staged object is always
 * deleted before this handler returns, whether or not it succeeded.
 *
 * Then patches this property's attributes.brf_annual_report (the exact slot
 * brfFinancialsProvider already reads) and re-runs the existing analysis
 * pipeline — no analyzer/engine changes, no quota consumed (same as the
 * existing "Update analysis" button).
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
  if (!(await hasAnyAnalysisRequestForProperty(user.id, propertyId))) {
    return errorResponse(404, "not_found", "No property with that id.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Request body must be JSON.");
  }

  const { stagingPath, filename, mimeType } =
    (body as { stagingPath?: unknown; filename?: unknown; mimeType?: unknown }) ?? {};
  if (
    typeof stagingPath !== "string" ||
    typeof filename !== "string" ||
    typeof mimeType !== "string" ||
    !stagingPath.startsWith(`staging/${user.id}/`)
  ) {
    console.error(
      `POST /api/properties/${propertyId}/brf-report rejected: invalid body`,
      { stagingPath, filename, mimeType, userId: user.id }
    );
    return errorResponse(400, "invalid_request", "Provide stagingPath, filename, and mimeType.");
  }

  const upload = classifyBrfMimeType(mimeType);
  if (!upload) {
    console.error(
      `POST /api/properties/${propertyId}/brf-report rejected: unsupported mimeType="${mimeType}" (filename="${filename}")`
    );
    return errorResponse(
      422,
      "invalid_file_type",
      "Ladda upp en PDF, ett Word-dokument (.docx) eller en bild av årsredovisningen."
    );
  }

  const storage = createAdminClient().storage.from(BRF_REPORTS_BUCKET);

  const { data: downloaded, error: downloadError } = await storage.download(stagingPath);
  if (downloadError || !downloaded) {
    console.error(
      `POST /api/properties/${propertyId}/brf-report failed: could not download staged upload ` +
        `"${stagingPath}" (filename="${filename}", size unknown):`,
      downloadError
    );
    return errorResponse(
      422,
      "upload_not_found",
      "Kunde inte hitta den uppladdade filen. Försök ladda upp den igen."
    );
  }

  const bytes = Buffer.from(await downloaded.arrayBuffer());

  if (bytes.byteLength > MAX_BRF_REPORT_BYTES) {
    console.error(
      `POST /api/properties/${propertyId}/brf-report rejected: downloaded size ${bytes.byteLength} bytes ` +
        `exceeds ${MAX_BRF_REPORT_BYTES} (filename="${filename}", stagingPath="${stagingPath}")`
    );
    await storage.remove([stagingPath]);
    return errorResponse(413, "file_too_large", "Filen är för stor (max 20 MB).");
  }

  const contentHash = createHash("sha256").update(bytes).digest("hex");

  const knownOrgNumber =
    typeof property.attributes.brf === "object" &&
    property.attributes.brf !== null &&
    typeof (property.attributes.brf as Record<string, unknown>).organization_number === "string"
      ? ((property.attributes.brf as Record<string, unknown>).organization_number as string)
      : null;

  const uploadContext = `filename="${filename}", mimeType="${mimeType}", size=${bytes.byteLength}, stagingPath="${stagingPath}"`;

  try {
    const apiBase = process.env.PYTHON_ENGINE_API_URL;
    if (!apiBase) {
      console.error(
        `POST /api/properties/${propertyId}/brf-report failed: PYTHON_ENGINE_API_URL is not configured (${uploadContext})`
      );
      return errorResponse(
        503,
        "not_connected",
        "The analysis engine is not configured (set PYTHON_ENGINE_API_URL)."
      );
    }

    let extractRes: Response;
    try {
      extractRes = await fetch(`${apiBase.replace(/\/$/, "")}/api/brf-annual-report/upload`, {
        method: "POST",
        headers: pythonEngineHeaders(),
        body: JSON.stringify({
          pdf_base64: bytes.toString("base64"),
          filename,
          file_kind: upload.fileKind,
        }),
        signal: AbortSignal.timeout(280000),
        cache: "no-store",
      });
    } catch (fetchErr) {
      console.error(
        `POST /api/properties/${propertyId}/brf-report failed: request to Python engine threw (${uploadContext}):`,
        fetchErr
      );
      return errorResponse(
        502,
        "engine_unreachable",
        "Kunde inte nå analysmotorn. Försök igen om en stund."
      );
    }

    const rawExtractBody = await extractRes.text();
    const extractBody = (() => {
      try {
        return JSON.parse(rawExtractBody);
      } catch {
        return null;
      }
    })();
    if (!extractRes.ok || !extractBody?.success) {
      console.error(
        `POST /api/properties/${propertyId}/brf-report failed: extraction rejected ` +
          `(${uploadContext}, engineStatus=${extractRes.status}): ` +
          rawExtractBody.slice(0, 2000)
      );
      return errorResponse(
        422,
        "extraction_failed",
        extractBody?.error ?? "Could not read that PDF as a BRF annual report."
      );
    }

    const storagePath = `${knownOrgNumber ?? `property-${propertyId}`}/${contentHash}.${upload.extension}`;
    const { error: uploadError } = await storage.upload(storagePath, bytes, {
      contentType: mimeType || "application/octet-stream",
      upsert: true,
    });
    if (uploadError) {
      console.error(
        `POST /api/properties/${propertyId}/brf-report failed: storage upload to "${storagePath}" failed (${uploadContext}):`,
        uploadError
      );
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const report = await saveBrfReport({
      organizationNumber: knownOrgNumber,
      fallbackPropertyId: knownOrgNumber ? null : propertyId,
      contentHash,
      storagePath,
      originalFilename: filename || null,
      fiscalYear: typeof extractBody.fiscal_year === "number" ? extractBody.fiscal_year : null,
      annualReport: extractBody.annual_report,
      uploadedBy: user.id,
    });

    await updateProperty(propertyId, {
      attributes: {
        ...property.attributes,
        brf_annual_report: report.annualReport,
        brf_report_id: report.id,
      },
    });

    const rerun = await rerunAnalysisForProperty(propertyId);
    if (!rerun) {
      console.error(
        `POST /api/properties/${propertyId}/brf-report failed: rerunAnalysisForProperty returned null after a successful upload/extraction (${uploadContext}) — property may have been deleted mid-request`
      );
      return errorResponse(404, "not_found", "No property with that id.");
    }

    return NextResponse.json({
      brfReportId: report.id,
      analysisId: rerun.analysis.id,
      propertyId: rerun.property.id,
      status: rerun.analysis.status,
    });
  } catch (err) {
    console.error(`POST /api/properties/${propertyId}/brf-report failed (${uploadContext}):`, err);
    return errorResponse(500, "internal_error", "Could not process the BRF annual report.");
  } finally {
    // Always clear the staged upload — whether this attempt succeeded,
    // failed, or was a dedup reuse — so staging/ never accumulates orphaned
    // objects. Best-effort: a failure here shouldn't change the response
    // already decided above.
    const { error: cleanupError } = await storage.remove([stagingPath]);
    if (cleanupError) {
      console.error(
        `POST /api/properties/${propertyId}/brf-report: failed to clean up staged upload "${stagingPath}":`,
        cleanupError
      );
    }
  }
}

/** GET /api/properties/:id/brf-report — current BRF report metadata for this property's card. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: propertyId } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const property = await findPropertyById(propertyId);
  if (!property) {
    return errorResponse(404, "not_found", "No property with that id.");
  }
  if (!(await hasAnyAnalysisRequestForProperty(user.id, propertyId))) {
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
