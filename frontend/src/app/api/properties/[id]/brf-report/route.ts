import { createHash } from "node:crypto";
import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPropertyById, updateProperty } from "@/lib/analysis/store";
import {
  BRF_REPORTS_BUCKET,
  EXTRACTION_FAILED,
  MAX_BRF_REPORT_BYTES,
  classifyBrfMimeType,
  getBrfReportById,
  saveBrfReport,
} from "@/lib/analysis/brfReports";
import { hasFullEntitlementForProperty } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";
import { isAdminUser } from "@/lib/auth/admin";
import { ensureBrfReview } from "@/lib/brf/reviews";
import { notifyTeamOfBrfReview } from "@/lib/brf/notify";
import { pythonEngineHeaders } from "@/lib/pythonEngine";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Matches the Python engine's own extraction budget (AbortSignal.timeout
// below) with headroom, and lets a large scanned report's per-page OCR
// (BRF-Scraper/src/brf_scraper/extractor/pdf_reader.py) actually finish
// instead of the function being killed mid-request.
export const maxDuration = 300;

type Extraction =
  | { ok: true; annualReport: Record<string, unknown>; keyFigures: Record<string, unknown> | null; fiscalYear: number | null }
  | { ok: false; reason: string };

/** Reads the file with the Python engine. A file the engine can't read is still kept — a reviewer reads it. */
async function extract(bytes: Buffer, filename: string, fileKind: string, context: string): Promise<Extraction> {
  const apiBase = process.env.PYTHON_ENGINE_API_URL;
  if (!apiBase) {
    console.error(`brf-report extraction skipped: PYTHON_ENGINE_API_URL is not configured (${context})`);
    return { ok: false, reason: "engine_not_configured" };
  }
  let res: Response;
  try {
    res = await fetch(`${apiBase.replace(/\/$/, "")}/api/brf-annual-report/upload`, {
      method: "POST",
      headers: pythonEngineHeaders(),
      body: JSON.stringify({ pdf_base64: bytes.toString("base64"), filename, file_kind: fileKind }),
      signal: AbortSignal.timeout(280000),
      cache: "no-store",
    });
  } catch (err) {
    console.error(`brf-report extraction failed: Python engine unreachable (${context}):`, err);
    return { ok: false, reason: "engine_unreachable" };
  }
  const raw = await res.text();
  let body: { success?: boolean; annual_report?: Record<string, unknown>; key_figures?: Record<string, unknown>; fiscal_year?: unknown; error?: string } | null = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  if (!res.ok || !body?.success || !body.annual_report) {
    console.error(`brf-report extraction rejected (${context}, engineStatus=${res.status}): ${raw.slice(0, 2000)}`);
    return { ok: false, reason: body?.error ?? `engine_status_${res.status}` };
  }
  return {
    ok: true,
    annualReport: body.annual_report,
    keyFigures: body.key_figures && typeof body.key_figures === "object" ? body.key_figures : null,
    fiscalYear: typeof body.fiscal_year === "number" ? body.fiscal_year : null,
  };
}

/**
 * POST /api/properties/:id/brf-report — step 2 of the annual-report upload
 * (lib/brf/uploadClient.ts): the browser has already PUT the file straight
 * into Storage via a signed URL from ./upload-url/route.ts, so this route
 * never receives the raw file and Vercel's 4.5 MB body limit doesn't apply.
 *
 * Who may upload: a customer who owns the full analysis of this property, or
 * a Köpanalys reviewer (lib/auth/admin.ts).
 *
 * What happens: the file is read by the Python engine (the figures and the
 * mandatory key figures become the reviewer's prefill), stored at its
 * permanent content-hash path, and handed to the property's BRF review —
 * which opens a new review round with a 24-hour deadline if an earlier review
 * was already published (lib/brf/reviews.ts). The BRF analysis a customer sees
 * comes only from the review, so nothing is re-analysed here. A file the
 * engine can't read is kept anyway: the reviewer reads it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const property = await findPropertyById(propertyId);
  if (!property) {
    return errorResponse(404, "not_found", "No property with that id.");
  }
  const isReviewer = isAdminUser(user);
  if (!isReviewer && !(await hasFullEntitlementForProperty(user.id, propertyId))) {
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
    console.error(`POST /api/properties/${propertyId}/brf-report rejected: invalid body`, { stagingPath, filename, mimeType, userId: user.id });
    return errorResponse(400, "invalid_request", "Provide stagingPath, filename, and mimeType.");
  }

  const upload = classifyBrfMimeType(mimeType);
  if (!upload) {
    console.error(`POST /api/properties/${propertyId}/brf-report rejected: unsupported mimeType="${mimeType}" (filename="${filename}")`);
    return errorResponse(422, "invalid_file_type", "Ladda upp en PDF, ett Word-dokument (.docx) eller en bild av årsredovisningen.");
  }

  const storage = createAdminClient().storage.from(BRF_REPORTS_BUCKET);

  const { data: downloaded, error: downloadError } = await storage.download(stagingPath);
  if (downloadError || !downloaded) {
    console.error(`POST /api/properties/${propertyId}/brf-report failed: could not download staged upload "${stagingPath}" (filename="${filename}"):`, downloadError);
    return errorResponse(422, "upload_not_found", "Kunde inte hitta den uppladdade filen. Försök ladda upp den igen.");
  }

  const bytes = Buffer.from(await downloaded.arrayBuffer());
  const context = `filename="${filename}", mimeType="${mimeType}", size=${bytes.byteLength}, stagingPath="${stagingPath}"`;

  try {
    if (bytes.byteLength > MAX_BRF_REPORT_BYTES) {
      console.error(`POST /api/properties/${propertyId}/brf-report rejected: downloaded size exceeds ${MAX_BRF_REPORT_BYTES} (${context})`);
      return errorResponse(413, "file_too_large", "Filen är för stor (max 20 MB).");
    }

    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const knownOrgNumber =
      typeof property.attributes.brf === "object" &&
      property.attributes.brf !== null &&
      typeof (property.attributes.brf as Record<string, unknown>).organization_number === "string"
        ? ((property.attributes.brf as Record<string, unknown>).organization_number as string)
        : null;

    const extraction = await extract(bytes, filename, upload.fileKind, context);

    const storagePath = `${knownOrgNumber ?? `property-${propertyId}`}/${contentHash}.${upload.extension}`;
    const { error: uploadError } = await storage.upload(storagePath, bytes, {
      contentType: mimeType || "application/octet-stream",
      upsert: true,
    });
    if (uploadError) {
      console.error(`POST /api/properties/${propertyId}/brf-report failed: storage upload to "${storagePath}" failed (${context}):`, uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const report = await saveBrfReport({
      organizationNumber: knownOrgNumber,
      fallbackPropertyId: knownOrgNumber ? null : propertyId,
      contentHash,
      storagePath,
      originalFilename: filename || null,
      fiscalYear: extraction.ok ? extraction.fiscalYear : null,
      annualReport: extraction.ok ? extraction.annualReport : { verification_status: EXTRACTION_FAILED, reason: extraction.reason },
      keyFigures: extraction.ok ? extraction.keyFigures : null,
      uploadedBy: user.id,
    });

    // brf_annual_report only ever holds a real extraction (it is what the
    // automatic BRF provider reads); the document itself is always linked.
    await updateProperty(propertyId, {
      attributes: {
        ...property.attributes,
        ...(extraction.ok ? { brf_annual_report: report.annualReport } : {}),
        brf_report_id: report.id,
      },
    });

    const { review, opened } = await ensureBrfReview(propertyId, "document", report.id);
    if (opened) {
      after(() =>
        notifyTeamOfBrfReview(review, "document").catch((err) =>
          console.error(`BRF review notification failed for property ${propertyId}:`, err)
        )
      );
    }

    return NextResponse.json({
      brfReportId: report.id,
      fiscalYear: report.fiscalYear,
      extracted: extraction.ok,
      review: { status: review.status, dueAt: review.status === "pending" ? review.dueAt : null },
    });
  } catch (err) {
    console.error(`POST /api/properties/${propertyId}/brf-report failed (${context}):`, err);
    return errorResponse(500, "internal_error", "Kunde inte ta emot årsredovisningen. Försök igen.");
  } finally {
    // Always clear the staged upload, whether this attempt succeeded or not.
    const { error: cleanupError } = await storage.remove([stagingPath]);
    if (cleanupError) {
      console.error(`POST /api/properties/${propertyId}/brf-report: failed to clean up staged upload "${stagingPath}":`, cleanupError);
    }
  }
}

/** GET /api/properties/:id/brf-report — the annual report currently attached to this property. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const property = await findPropertyById(propertyId);
  if (!property) {
    return errorResponse(404, "not_found", "No property with that id.");
  }
  if (!isAdminUser(user) && !(await hasFullEntitlementForProperty(user.id, propertyId))) {
    return errorResponse(404, "not_found", "No property with that id.");
  }

  const reportId = typeof property.attributes.brf_report_id === "string" ? property.attributes.brf_report_id : null;
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
