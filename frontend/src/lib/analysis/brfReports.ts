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
 * Looks for a non-expired report we can reuse instead of re-uploading and
 * re-extracting: an exact byte match (content_hash), or — when no
 * organization_number is known for this upload — the most recent report
 * already on file for this property.
 */
export async function findReusableBrfReport(input: {
  contentHash: string;
  organizationNumber: string | null;
  propertyId: string;
}): Promise<BrfAnnualReportRecord | null> {
  const client = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: exact, error: exactError } = await client
    .from("brf_annual_reports")
    .select("*")
    .eq("content_hash", input.contentHash)
    .gt("retain_until", nowIso)
    .maybeSingle();
  if (exactError) throw new Error(`findReusableBrfReport failed: ${exactError.message}`);
  if (exact) return mapRow(exact as BrfAnnualReportRow);

  if (input.organizationNumber) {
    const { data: byOrg, error: orgError } = await client
      .from("brf_annual_reports")
      .select("*")
      .eq("organization_number", input.organizationNumber)
      .gt("retain_until", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orgError) throw new Error(`findReusableBrfReport failed: ${orgError.message}`);
    if (byOrg) return mapRow(byOrg as BrfAnnualReportRow);
    return null;
  }

  const { data: byProperty, error: propertyError } = await client
    .from("brf_annual_reports")
    .select("*")
    .eq("fallback_property_id", input.propertyId)
    .gt("retain_until", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (propertyError) throw new Error(`findReusableBrfReport failed: ${propertyError.message}`);
  return byProperty ? mapRow(byProperty as BrfAnnualReportRow) : null;
}

export async function insertBrfReport(input: {
  organizationNumber: string | null;
  fallbackPropertyId: string | null;
  contentHash: string;
  storagePath: string;
  originalFilename: string | null;
  fiscalYear: number | null;
  annualReport: Record<string, unknown>;
  uploadedBy: string;
}): Promise<BrfAnnualReportRecord> {
  const { data, error } = await createAdminClient()
    .from("brf_annual_reports")
    .insert({
      organization_number: input.organizationNumber,
      fallback_property_id: input.fallbackPropertyId,
      content_hash: input.contentHash,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      fiscal_year: input.fiscalYear,
      annual_report: input.annualReport,
      uploaded_by: input.uploadedBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(`insertBrfReport failed: ${error.message}`);
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
