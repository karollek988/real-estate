import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared, deduplicated BRF annual report storage (see
 * supabase/migrations/20260722000300_brf_annual_reports.sql). Reports are
 * grouped by organization_number when known, or by the uploading property
 * as a fallback, and are never re-stored if byte-identical to an existing
 * report. Retention (365 days) is enforced at read time via retain_until —
 * no scheduled purge job exists yet; see PROJECT_STATUS.md for the manual
 * cleanup query.
 */

export const BRF_REPORTS_BUCKET = "brf-annual-reports";

/** Max size for a user-uploaded BRF annual report (PDF/docx/image). Enforced
 * both when issuing the upload URL (against the client's declared size) and
 * again server-side against the actual downloaded bytes — see
 * api/properties/[id]/brf-report/{upload-url,}/route.ts. */
export const MAX_BRF_REPORT_BYTES = 20 * 1024 * 1024; // 20MB — annual reports can run many pages

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Maps an uploaded file's declared MIME type to the Python engine's
 * file_kind + a storage extension, or null if unsupported. */
export function classifyBrfMimeType(mimeType: string): { fileKind: "pdf" | "docx" | "image"; extension: string } | null {
  if (mimeType === "application/pdf") return { fileKind: "pdf", extension: "pdf" };
  if (mimeType === DOCX_MIME) return { fileKind: "docx", extension: "docx" };
  if (mimeType.startsWith("image/")) {
    const extension = mimeType.split("/")[1]?.split("+")[0] || "img";
    return { fileKind: "image", extension };
  }
  return null;
}

export interface BrfAnnualReportRecord {
  id: string;
  organizationNumber: string | null;
  fallbackPropertyId: string | null;
  contentHash: string;
  storagePath: string;
  originalFilename: string | null;
  fiscalYear: number | null;
  annualReport: Record<string, unknown>;
  uploadedBy: string | null;
  createdAt: string;
  retainUntil: string;
}

interface BrfAnnualReportRow {
  id: string;
  organization_number: string | null;
  fallback_property_id: string | null;
  content_hash: string;
  storage_path: string;
  original_filename: string | null;
  fiscal_year: number | null;
  annual_report: Record<string, unknown>;
  uploaded_by: string | null;
  created_at: string;
  retain_until: string;
}

function mapRow(row: BrfAnnualReportRow): BrfAnnualReportRecord {
  return {
    id: row.id,
    organizationNumber: row.organization_number,
    fallbackPropertyId: row.fallback_property_id,
    contentHash: row.content_hash,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    fiscalYear: row.fiscal_year,
    annualReport: row.annual_report,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    retainUntil: row.retain_until,
  };
}

/**
 * Stores an extracted report, one row per distinct file (content_hash is
 * unique). Uploading a file that is already on file refreshes that row with
 * the new extraction instead of returning the old one.
 *
 * An upload used to be answered from whatever was already stored — for a
 * byte-identical file, and (when no organization number was known) for ANY
 * earlier report on the same property — so a poor extraction from an older
 * engine version was returned again for every later upload, however good the
 * current extractor is, and a newer report could never replace it. A person
 * who uploads a document wants it read now, so it is always re-extracted.
 */
export async function saveBrfReport(input: {
  organizationNumber: string | null;
  fallbackPropertyId: string | null;
  contentHash: string;
  storagePath: string;
  originalFilename: string | null;
  fiscalYear: number | null;
  annualReport: Record<string, unknown>;
  /** null for reports discovered by the automated background pipeline (no user in context) — the column is nullable for exactly this case. */
  uploadedBy: string | null;
}): Promise<BrfAnnualReportRecord> {
  const { data, error } = await createAdminClient()
    .from("brf_annual_reports")
    .upsert(
      {
        organization_number: input.organizationNumber,
        fallback_property_id: input.fallbackPropertyId,
        content_hash: input.contentHash,
        storage_path: input.storagePath,
        original_filename: input.originalFilename,
        fiscal_year: input.fiscalYear,
        annual_report: input.annualReport,
        uploaded_by: input.uploadedBy,
        retain_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "content_hash" }
    )
    .select("*")
    .single();
  if (error) throw new Error(`saveBrfReport failed: ${error.message}`);
  return mapRow(data as BrfAnnualReportRow);
}

export async function getBrfReportById(id: string): Promise<BrfAnnualReportRecord | null> {
  const { data, error } = await createAdminClient()
    .from("brf_annual_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getBrfReportById failed: ${error.message}`);
  return data ? mapRow(data as BrfAnnualReportRow) : null;
}
