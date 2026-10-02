import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared, deduplicated storage of the BRF annual reports that have been
 * uploaded — by the buyer from their report, or by a Köpanalys reviewer from
 * the review console (see supabase/migrations/20260722000300_brf_annual_reports.sql).
 * Reports are grouped by organization_number when known, or by the uploading
 * property as a fallback, and are never re-stored if byte-identical to an
 * existing report. Retention (365 days) is enforced at read time via
 * retain_until — no scheduled purge job exists yet; see PROJECT_STATUS.md for
 * the manual cleanup query.
 */

export { BRF_REPORTS_BUCKET, MAX_BRF_REPORT_BYTES, classifyBrfMimeType } from "@/lib/brf/uploadLimits";

/** Stored instead of an extraction when the engine could not read the file: the reviewer still reads the document itself. */
export const EXTRACTION_FAILED = "extraction_failed";

export interface BrfAnnualReportRecord {
  id: string;
  organizationNumber: string | null;
  fallbackPropertyId: string | null;
  contentHash: string;
  storagePath: string;
  originalFilename: string | null;
  fiscalYear: number | null;
  annualReport: Record<string, unknown>;
  /** The key figures the extraction read from the report ({ values, evidence }) — the reviewer's prefill. */
  keyFigures: { values: Record<string, unknown>; evidence: Record<string, string> } | null;
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
  key_figures: { values?: Record<string, unknown>; evidence?: Record<string, string> } | null;
  uploaded_by: string | null;
  created_at: string;
  retain_until: string;
}

function mapRow(row: BrfAnnualReportRow): BrfAnnualReportRecord {
  const kf = row.key_figures;
  return {
    id: row.id,
    organizationNumber: row.organization_number,
    fallbackPropertyId: row.fallback_property_id,
    contentHash: row.content_hash,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    fiscalYear: row.fiscal_year,
    annualReport: row.annual_report,
    keyFigures: kf && typeof kf === "object" ? { values: kf.values ?? {}, evidence: kf.evidence ?? {} } : null,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    retainUntil: row.retain_until,
  };
}

/**
 * Stores an uploaded report, one row per distinct file (content_hash is
 * unique). Uploading a file that is already on file refreshes that row with
 * the new extraction instead of returning the old one: a person who uploads a
 * document wants it read now, by the current engine.
 */
export async function saveBrfReport(input: {
  organizationNumber: string | null;
  fallbackPropertyId: string | null;
  contentHash: string;
  storagePath: string;
  originalFilename: string | null;
  fiscalYear: number | null;
  annualReport: Record<string, unknown>;
  keyFigures: Record<string, unknown> | null;
  /** The uploading buyer or reviewer. Nullable only because older rows were written by the removed automated pipeline. */
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
        key_figures: input.keyFigures,
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
