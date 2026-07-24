import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { findPremiumAnalysisForProperty } from "@/lib/analysis/ownership";
import { findPropertyById } from "@/lib/analysis/store";
import {
  createSignedUrl,
  findInspection,
  createInspection,
  insertDocument,
  listDocuments,
  INSPECTION_FILES_BUCKET,
} from "@/lib/inspection/store";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentType } from "@/lib/inspection/types";

const DOC_TYPES: DocumentType[] = [
  "annual_report",
  "inspection_report",
  "energy_declaration",
  "floor_plan",
  "maintenance_plan",
  "bylaws",
  "other",
];

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** POST /api/inspections/:propertyId/documents — upload a preparation document (PART 6). */
export async function POST(request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const property = await findPropertyById(propertyId);
  if (!property) return errorResponse(404, "not_found", "No property with that id.");

  const premium = await findPremiumAnalysisForProperty(user.id, propertyId);
  if (!premium) return errorResponse(403, "premium_required", "Kräver en Premium-analys för den här bostaden.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "invalid_request", "Request must be multipart/form-data.");
  }

  const file = form.get("file");
  const docType = form.get("docType");
  if (!(file instanceof File)) return errorResponse(400, "invalid_request", "Provide the file as \"file\".");
  if (typeof docType !== "string" || !DOC_TYPES.includes(docType as DocumentType)) {
    return errorResponse(400, "invalid_request", "Provide a valid \"docType\".");
  }
  if (file.type && file.type !== "application/pdf" && !file.type.startsWith("image/")) {
    return errorResponse(422, "invalid_file_type", "Only PDF or image files are supported.");
  }

  let inspection = await findInspection(user.id, propertyId);
  if (!inspection) inspection = await createInspection(user.id, propertyId, null);

  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `${propertyId}/documents/${inspection.id}/${randomUUID()}-${file.name || "document"}`;

  const { error: uploadError } = await createAdminClient()
    .storage.from(INSPECTION_FILES_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) {
    console.error(`POST /api/inspections/${propertyId}/documents upload failed:`, uploadError);
    return errorResponse(500, "internal_error", "Kunde inte spara dokumentet. Försök igen.");
  }

  const document = await insertDocument({
    inspectionId: inspection.id,
    docType: docType as DocumentType,
    storagePath,
    originalFilename: file.name || null,
    contentType: file.type || null,
    uploadedBy: user.id,
  });

  return NextResponse.json({ document });
}

/** GET /api/inspections/:propertyId/documents — list uploaded documents with short-lived signed URLs. */
export async function GET(_request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const inspection = await findInspection(user.id, propertyId);
  if (!inspection) return NextResponse.json({ documents: [] });

  const documents = await listDocuments(inspection.id);
  const withUrls = await Promise.all(
    documents.map(async (d) => ({ ...d, url: await createSignedUrl(d.storagePath) }))
  );
  return NextResponse.json({ documents: withUrls });
}
