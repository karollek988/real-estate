import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ChecklistState,
  DocumentType,
  InspectionDocument,
  InspectionPhoto,
  InspectionRecord,
  InspectionStatus,
  InspectionSummary,
  Observation,
  PrepChecklistState,
} from "./types";

/**
 * Persistence layer for the Besiktningshjälp (Inspection Assistant) feature.
 * Mirrors src/lib/analysis/store.ts's conventions: service-role access only,
 * snake_case rows mapped to camelCase records.
 */

export const INSPECTION_FILES_BUCKET = "inspection-files";

interface InspectionRow {
  id: string;
  user_id: string;
  property_id: string;
  analysis_id: string | null;
  step: number;
  status: InspectionStatus;
  prep_checklist: PrepChecklistState;
  checklist: ChecklistState;
  observations: Observation[];
  summary: InspectionSummary | null;
  created_at: string;
  updated_at: string;
}

interface DocumentRow {
  id: string;
  inspection_id: string;
  doc_type: DocumentType;
  storage_path: string;
  original_filename: string | null;
  content_type: string | null;
  uploaded_by: string;
  created_at: string;
}

interface PhotoRow {
  id: string;
  inspection_id: string;
  room: string;
  checkpoint_id: string | null;
  storage_path: string;
  original_filename: string | null;
  created_at: string;
}

function mapInspection(row: InspectionRow): InspectionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    propertyId: row.property_id,
    analysisId: row.analysis_id,
    step: (row.step ?? 1) as 1 | 2 | 3,
    status: row.status,
    prepChecklist: row.prep_checklist ?? {},
    checklist: row.checklist ?? {},
    observations: row.observations ?? [],
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocument(row: DocumentRow): InspectionDocument {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    docType: row.doc_type,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

function mapPhoto(row: PhotoRow): InspectionPhoto {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    room: row.room,
    checkpointId: row.checkpoint_id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    createdAt: row.created_at,
  };
}

export async function findInspection(userId: string, propertyId: string): Promise<InspectionRecord | null> {
  const { data, error } = await createAdminClient()
    .from("inspections")
    .select("*")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) throw new Error(`findInspection failed: ${error.message}`);
  return data ? mapInspection(data as InspectionRow) : null;
}

export async function findInspectionById(id: string): Promise<InspectionRecord | null> {
  const { data, error } = await createAdminClient().from("inspections").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`findInspectionById failed: ${error.message}`);
  return data ? mapInspection(data as InspectionRow) : null;
}

export async function createInspection(
  userId: string,
  propertyId: string,
  analysisId: string | null
): Promise<InspectionRecord> {
  const { data, error } = await createAdminClient()
    .from("inspections")
    .insert({ user_id: userId, property_id: propertyId, analysis_id: analysisId })
    .select("*")
    .single();
  if (error) throw new Error(`createInspection failed: ${error.message}`);
  return mapInspection(data as InspectionRow);
}

export interface InspectionPatch {
  step?: 1 | 2 | 3;
  status?: InspectionStatus;
  prepChecklist?: PrepChecklistState;
  checklist?: ChecklistState;
  observations?: Observation[];
  summary?: InspectionSummary | null;
}

export async function updateInspection(id: string, patch: InspectionPatch): Promise<InspectionRecord> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.step !== undefined) row.step = patch.step;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.prepChecklist !== undefined) row.prep_checklist = patch.prepChecklist;
  if (patch.checklist !== undefined) row.checklist = patch.checklist;
  if (patch.observations !== undefined) row.observations = patch.observations;
  if (patch.summary !== undefined) row.summary = patch.summary;

  const { data, error } = await createAdminClient()
    .from("inspections")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateInspection failed: ${error.message}`);
  return mapInspection(data as InspectionRow);
}

export async function listDocuments(inspectionId: string): Promise<InspectionDocument[]> {
  const { data, error } = await createAdminClient()
    .from("inspection_documents")
    .select("*")
    .eq("inspection_id", inspectionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listDocuments failed: ${error.message}`);
  return (data as DocumentRow[]).map(mapDocument);
}

export async function insertDocument(input: {
  inspectionId: string;
  docType: DocumentType;
  storagePath: string;
  originalFilename: string | null;
  contentType: string | null;
  uploadedBy: string;
}): Promise<InspectionDocument> {
  const { data, error } = await createAdminClient()
    .from("inspection_documents")
    .insert({
      inspection_id: input.inspectionId,
      doc_type: input.docType,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      content_type: input.contentType,
      uploaded_by: input.uploadedBy,
    })
    .select("*")
    .single();
  if (error) throw new Error(`insertDocument failed: ${error.message}`);
  return mapDocument(data as DocumentRow);
}

export async function listPhotos(inspectionId: string): Promise<InspectionPhoto[]> {
  const { data, error } = await createAdminClient()
    .from("inspection_photos")
    .select("*")
    .eq("inspection_id", inspectionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listPhotos failed: ${error.message}`);
  return (data as PhotoRow[]).map(mapPhoto);
}

export async function insertPhoto(input: {
  inspectionId: string;
  room: string;
  checkpointId: string | null;
  storagePath: string;
  originalFilename: string | null;
}): Promise<InspectionPhoto> {
  const { data, error } = await createAdminClient()
    .from("inspection_photos")
    .insert({
      inspection_id: input.inspectionId,
      room: input.room,
      checkpoint_id: input.checkpointId,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
    })
    .select("*")
    .single();
  if (error) throw new Error(`insertPhoto failed: ${error.message}`);
  return mapPhoto(data as PhotoRow);
}

export async function createSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .storage.from(INSPECTION_FILES_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
