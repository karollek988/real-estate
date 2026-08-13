import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Documents auto-discovered on a listing broker's own website (see
 * supabase/migrations/20260723000500_broker_documents.sql). Scoped per
 * property, deduplicated by (property_id, content_hash) — distinct from
 * brf_annual_reports (cross-property canonical PDF store, see
 * brfReports.ts) and inspection_documents (user-driven manual uploads).
 */

export const BROKER_DOCUMENTS_BUCKET = "broker-documents";

export type BrokerDocumentType =
  | "annual_report"
  | "inspection_report"
  | "energy_declaration"
  | "bylaws"
  | "floor_plan"
  | "other";

export interface BrokerDocumentRecord {
  id: string;
  propertyId: string;
  docType: BrokerDocumentType;
  storagePath: string;
  originalFilename: string | null;
  contentType: string | null;
  contentHash: string;
  sourceUrl: string;
  brokerUrl: string | null;
  discoveredAt: string;
  aiFindings: Record<string, unknown> | null;
  aiModel: string | null;
  brfAnnualReportId: string | null;
}

interface BrokerDocumentRow {
  id: string;
  property_id: string;
  doc_type: BrokerDocumentType;
  storage_path: string;
  original_filename: string | null;
  content_type: string | null;
  content_hash: string;
  source_url: string;
  broker_url: string | null;
  discovered_at: string;
  ai_findings: Record<string, unknown> | null;
  ai_model: string | null;
  brf_annual_report_id: string | null;
}

function mapRow(row: BrokerDocumentRow): BrokerDocumentRecord {
  return {
    id: row.id,
    propertyId: row.property_id,
    docType: row.doc_type,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    contentHash: row.content_hash,
    sourceUrl: row.source_url,
    brokerUrl: row.broker_url,
    discoveredAt: row.discovered_at,
    aiFindings: row.ai_findings,
    aiModel: row.ai_model,
    brfAnnualReportId: row.brf_annual_report_id,
  };
}

/** Existing row for this property + content hash, if this exact document was already stored. */
export async function findExistingBrokerDocument(
  propertyId: string,
  contentHash: string
): Promise<BrokerDocumentRecord | null> {
  const { data, error } = await createAdminClient()
    .from("broker_documents")
    .select("*")
    .eq("property_id", propertyId)
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (error) throw new Error(`findExistingBrokerDocument failed: ${error.message}`);
  return data ? mapRow(data as BrokerDocumentRow) : null;
}

export async function insertBrokerDocument(input: {
  propertyId: string;
  docType: BrokerDocumentType;
  storagePath: string;
  originalFilename: string | null;
  contentType: string | null;
  contentHash: string;
  sourceUrl: string;
  brokerUrl: string | null;
  aiFindings: Record<string, unknown> | null;
  aiModel: string | null;
  brfAnnualReportId: string | null;
}): Promise<BrokerDocumentRecord> {
  const { data, error } = await createAdminClient()
    .from("broker_documents")
    .insert({
      property_id: input.propertyId,
      doc_type: input.docType,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      content_type: input.contentType,
      content_hash: input.contentHash,
      source_url: input.sourceUrl,
      broker_url: input.brokerUrl,
      ai_findings: input.aiFindings,
      ai_model: input.aiModel,
      brf_annual_report_id: input.brfAnnualReportId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`insertBrokerDocument failed: ${error.message}`);
  return mapRow(data as BrokerDocumentRow);
}

export async function listBrokerDocumentsForProperty(propertyId: string): Promise<BrokerDocumentRecord[]> {
  const { data, error } = await createAdminClient()
    .from("broker_documents")
    .select("*")
    .eq("property_id", propertyId)
    .order("discovered_at", { ascending: false });
  if (error) throw new Error(`listBrokerDocumentsForProperty failed: ${error.message}`);
  return (data as BrokerDocumentRow[]).map(mapRow);
}

export async function getBrokerDocumentById(id: string): Promise<BrokerDocumentRecord | null> {
  const { data, error } = await createAdminClient()
    .from("broker_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getBrokerDocumentById failed: ${error.message}`);
  return data ? mapRow(data as BrokerDocumentRow) : null;
}
