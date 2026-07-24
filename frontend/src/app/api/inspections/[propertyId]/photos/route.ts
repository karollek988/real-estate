import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { findPremiumAnalysisForProperty } from "@/lib/analysis/ownership";
import {
  createSignedUrl,
  findInspection,
  createInspection,
  insertPhoto,
  listPhotos,
  INSPECTION_FILES_BUCKET,
} from "@/lib/inspection/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROOMS } from "@/lib/inspection/types";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** POST /api/inspections/:propertyId/photos — attach a photo to a room/checkpoint (PART 7). */
export async function POST(request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const premium = await findPremiumAnalysisForProperty(user.id, propertyId);
  if (!premium) return errorResponse(403, "premium_required", "Kräver en Premium-analys för den här bostaden.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "invalid_request", "Request must be multipart/form-data.");
  }

  const file = form.get("file");
  const room = form.get("room");
  const checkpointId = form.get("checkpointId");
  if (!(file instanceof File)) return errorResponse(400, "invalid_request", "Provide the photo as \"file\".");
  if (typeof room !== "string" || !ROOMS.some((r) => r.id === room)) {
    return errorResponse(400, "invalid_request", "Provide a valid \"room\".");
  }
  if (file.type && !file.type.startsWith("image/")) {
    return errorResponse(422, "invalid_file_type", "Only image files are supported.");
  }

  let inspection = await findInspection(user.id, propertyId);
  if (!inspection) inspection = await createInspection(user.id, propertyId, null);

  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = `${propertyId}/photos/${inspection.id}/${room}/${randomUUID()}-${file.name || "photo"}`;

  const { error: uploadError } = await createAdminClient()
    .storage.from(INSPECTION_FILES_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || "image/jpeg", upsert: false });
  if (uploadError) {
    console.error(`POST /api/inspections/${propertyId}/photos upload failed:`, uploadError);
    return errorResponse(500, "internal_error", "Kunde inte spara fotot. Försök igen.");
  }

  const photo = await insertPhoto({
    inspectionId: inspection.id,
    room,
    checkpointId: typeof checkpointId === "string" ? checkpointId : null,
    storagePath,
    originalFilename: file.name || null,
  });

  const url = await createSignedUrl(photo.storagePath);
  return NextResponse.json({ photo: { ...photo, url } });
}

/** GET /api/inspections/:propertyId/photos — list photos with short-lived signed URLs. */
export async function GET(_request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  const inspection = await findInspection(user.id, propertyId);
  if (!inspection) return NextResponse.json({ photos: [] });

  const photos = await listPhotos(inspection.id);
  const withUrls = await Promise.all(
    photos.map(async (p) => ({ ...p, url: await createSignedUrl(p.storagePath) }))
  );
  return NextResponse.json({ photos: withUrls });
}
