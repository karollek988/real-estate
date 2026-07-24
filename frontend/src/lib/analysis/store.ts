import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AnalysisRecord,
  AnalysisReport,
  DataSourceReport,
  ExtractedProperty,
  FieldProvenance,
  PropertyRecord,
} from "./types";
import type { PropertyEnrichment } from "./providers/types";

/**
 * Persistence layer for properties and analyses. All access goes through the
 * service-role client (both tables are RLS-locked to the server).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UNIQUE_VIOLATION = "23505";

interface PropertyRow {
  id: string;
  normalized_key: string;
  address: string;
  hemnet_url: string | null;
  latitude: number | null;
  longitude: number | null;
  municipality: string | null;
  postal_code: string | null;
  property_type: string | null;
  apartment_number: string | null;
  floor: number | null;
  attributes: Record<string, unknown>;
  field_provenance: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface AnalysisRow {
  id: string;
  property_id: string;
  version: number;
  engine_version: string;
  status: "pending" | "complete" | "failed";
  decision_score: number | null;
  result: AnalysisReport | null;
  data_sources: DataSourceReport[];
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

function mapProperty(row: PropertyRow): PropertyRecord {
  return {
    id: row.id,
    normalizedKey: row.normalized_key,
    address: row.address,
    hemnetUrl: row.hemnet_url,
    latitude: row.latitude,
    longitude: row.longitude,
    municipality: row.municipality,
    postalCode: row.postal_code,
    propertyType: row.property_type,
    apartmentNumber: row.apartment_number,
    floor: row.floor,
    attributes: row.attributes ?? {},
    fieldProvenance: (row.field_provenance ?? {}) as FieldProvenance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAnalysis(row: AnalysisRow): AnalysisRecord {
  return {
    id: row.id,
    propertyId: row.property_id,
    version: row.version,
    engineVersion: row.engine_version,
    status: row.status,
    decisionScore: row.decision_score,
    report: row.result,
    dataSources: row.data_sources ?? [],
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export async function findPropertyByHemnetUrl(hemnetUrl: string): Promise<PropertyRecord | null> {
  const { data, error } = await createAdminClient()
    .from("properties")
    .select("*")
    .eq("hemnet_url", hemnetUrl)
    .maybeSingle();
  if (error) throw new Error(`findPropertyByHemnetUrl failed: ${error.message}`);
  return data ? mapProperty(data as PropertyRow) : null;
}

export async function findPropertyByKey(normalizedKey: string): Promise<PropertyRecord | null> {
  const { data, error } = await createAdminClient()
    .from("properties")
    .select("*")
    .eq("normalized_key", normalizedKey)
    .maybeSingle();
  if (error) throw new Error(`findPropertyByKey failed: ${error.message}`);
  return data ? mapProperty(data as PropertyRow) : null;
}

export async function findPropertyById(id: string): Promise<PropertyRecord | null> {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await createAdminClient()
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`findPropertyById failed: ${error.message}`);
  return data ? mapProperty(data as PropertyRow) : null;
}

/**
 * Returns the inserted property, or null on a normalized_key/hemnet_url
 * conflict (a concurrent request created it first — caller should re-fetch).
 */
export async function insertProperty(
  extracted: ExtractedProperty,
  normalizedKey: string
): Promise<PropertyRecord | null> {
  const { data, error } = await createAdminClient()
    .from("properties")
    .insert({
      normalized_key: normalizedKey,
      address: extracted.address,
      hemnet_url: extracted.hemnetUrl,
      municipality: extracted.municipality,
      postal_code: extracted.postalCode,
      property_type: extracted.propertyType,
      apartment_number: extracted.apartmentNumber,
      floor: extracted.floor,
      attributes: extracted.attributes,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return null;
    throw new Error(`insertProperty failed: ${error.message}`);
  }
  return mapProperty(data as PropertyRow);
}

export async function updateProperty(
  id: string,
  patch: PropertyEnrichment & {
    normalizedKey?: string;
    hemnetUrl?: string;
    propertyType?: string;
    apartmentNumber?: string;
    floor?: number;
    attributes?: Record<string, unknown>;
    fieldProvenance?: FieldProvenance;
  }
): Promise<PropertyRecord> {
  const row: Record<string, unknown> = {};
  if (patch.normalizedKey !== undefined) row.normalized_key = patch.normalizedKey;
  if (patch.latitude !== undefined) row.latitude = patch.latitude;
  if (patch.longitude !== undefined) row.longitude = patch.longitude;
  if (patch.municipality !== undefined) row.municipality = patch.municipality;
  if (patch.postalCode !== undefined) row.postal_code = patch.postalCode;
  if (patch.hemnetUrl !== undefined) row.hemnet_url = patch.hemnetUrl;
  if (patch.propertyType !== undefined) row.property_type = patch.propertyType;
  if (patch.apartmentNumber !== undefined) row.apartment_number = patch.apartmentNumber;
  if (patch.floor !== undefined) row.floor = patch.floor;
  if (patch.attributes !== undefined) row.attributes = patch.attributes;
  if (patch.fieldProvenance !== undefined) row.field_provenance = patch.fieldProvenance;

  if (Object.keys(row).length === 0) {
    const unchanged = await findPropertyById(id);
    if (!unchanged) throw new Error("updateProperty failed: property not found");
    return unchanged;
  }

  const { data, error } = await createAdminClient()
    .from("properties")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    // A recomputed normalized_key can collide with an existing property (the
    // canonical form already exists as its own row); keep the old key then.
    if (error.code === UNIQUE_VIOLATION && patch.normalizedKey !== undefined) {
      const { normalizedKey: _dropped, ...rest } = patch;
      return updateProperty(id, rest);
    }
    throw new Error(`updateProperty failed: ${error.message}`);
  }
  return mapProperty(data as PropertyRow);
}

/** Newest completed analysis for a property (the cache-check target). */
export async function latestCompleteAnalysis(propertyId: string): Promise<AnalysisRecord | null> {
  const { data, error } = await createAdminClient()
    .from("analyses")
    .select("*")
    .eq("property_id", propertyId)
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`latestCompleteAnalysis failed: ${error.message}`);
  return data ? mapAnalysis(data as AnalysisRow) : null;
}

/**
 * Creates the next analysis version for a property. Versions are per-property
 * and enforced unique in the database; on a concurrent-insert collision the
 * version is recomputed once.
 */
export async function insertPendingAnalysis(
  propertyId: string,
  engineVersion: string
): Promise<AnalysisRecord> {
  const client = createAdminClient();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: latest, error: versionError } = await client
      .from("analyses")
      .select("version")
      .eq("property_id", propertyId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (versionError) throw new Error(`insertPendingAnalysis failed: ${versionError.message}`);
    const version = ((latest as { version: number } | null)?.version ?? 0) + 1;

    const { data, error } = await client
      .from("analyses")
      .insert({ property_id: propertyId, version, engine_version: engineVersion })
      .select("*")
      .single();
    if (!error) return mapAnalysis(data as AnalysisRow);
    if (error.code !== UNIQUE_VIOLATION) {
      throw new Error(`insertPendingAnalysis failed: ${error.message}`);
    }
  }
  throw new Error("insertPendingAnalysis failed: could not allocate an analysis version");
}

export async function completeAnalysis(
  id: string,
  report: AnalysisReport
): Promise<AnalysisRecord> {
  const { data, error } = await createAdminClient()
    .from("analyses")
    .update({
      status: "complete",
      decision_score: report.decisionScore,
      result: report,
      data_sources: report.dataSources,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`completeAnalysis failed: ${error.message}`);
  return mapAnalysis(data as AnalysisRow);
}

export async function failAnalysis(id: string, message: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("analyses")
    .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`failAnalysis failed: ${error.message}`);
}

export async function getAnalysisWithProperty(
  analysisId: string
): Promise<{ analysis: AnalysisRecord; property: PropertyRecord } | null> {
  if (!UUID_RE.test(analysisId)) return null;
  const { data, error } = await createAdminClient()
    .from("analyses")
    .select("*, property:properties(*)")
    .eq("id", analysisId)
    .maybeSingle();
  if (error) throw new Error(`getAnalysisWithProperty failed: ${error.message}`);
  if (!data) return null;
  const { property, ...analysisRow } = data as AnalysisRow & { property: PropertyRow };
  return { analysis: mapAnalysis(analysisRow), property: mapProperty(property) };
}

/** Full version history for a property, newest first. Analyses are never deleted. */
export async function listAnalysesForProperty(propertyId: string): Promise<AnalysisRecord[]> {
  if (!UUID_RE.test(propertyId)) return [];
  const { data, error } = await createAdminClient()
    .from("analyses")
    .select("*")
    .eq("property_id", propertyId)
    .order("version", { ascending: false });
  if (error) throw new Error(`listAnalysesForProperty failed: ${error.message}`);
  return (data as AnalysisRow[]).map(mapAnalysis);
}
