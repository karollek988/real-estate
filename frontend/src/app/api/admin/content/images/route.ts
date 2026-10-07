import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { isSameOriginRequest } from "@/lib/admin/requestGuards";
import { errorResponse } from "@/lib/content/editorRequest";
import { ImageUploadError, MAX_UPLOAD_BYTES, listUploadedImages, uploadContentImage } from "@/lib/content/imageUpload";

/** GET /api/admin/content/images - the latest uploaded pictures, for the editor's picker (admins only). */
export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;
  return NextResponse.json({ images: await listUploadedImages() });
}

/**
 * POST /api/admin/content/images - uploads one picture (multipart, field
 * "file"; admins only, from the site itself). It is checked and re-encoded
 * before it is stored (lib/content/imageUpload.ts); the answer holds its
 * public address.
 */
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;
  if (!isSameOriginRequest(request)) return errorResponse(403, "forbidden", "Begäran måste komma från sajten själv.");

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return errorResponse(413, "too_large", "Bilden är för stor (högst 12 MB).");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "invalid_request", "Skicka bilden som multipart/form-data.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return errorResponse(400, "invalid_request", 'Skicka bilden i fältet "file".');
  if (file.size > MAX_UPLOAD_BYTES) return errorResponse(413, "too_large", "Bilden är för stor (högst 12 MB).");

  try {
    const image = await uploadContentImage(new Uint8Array(await file.arrayBuffer()), file.name);
    return NextResponse.json({ image }, { status: 201 });
  } catch (err) {
    if (err instanceof ImageUploadError) {
      const status = err.code === "too_large" ? 413 : err.code === "unsupported_type" || err.code === "unreadable" ? 422 : 503;
      if (status === 503) console.error("Content image upload failed:", err.message);
      return errorResponse(status, err.code, err.message);
    }
    console.error("Content image upload failed:", err);
    return errorResponse(500, "server_error", "Bilden kunde inte sparas. Försök igen.");
  }
}
