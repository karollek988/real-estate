import { NextResponse } from "next/server";
import { apiError } from "@/i18n/apiText";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit } from "@/lib/rateLimit";
import { MAX_MAP_UPLOAD_BYTES, MapImageError, mapImageUrl, storeMapImage } from "@/lib/map/images";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/map/images - a signed-in user uploads the picture of a pin (multipart, field "file"). The answer is
 * { path, url }: the path goes into the listing's "image" when it is saved. See lib/map/images.ts for what the server
 * does to the file before it is stored.
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  if (!checkRateLimit(`map-image:${user.id}`, 30, 60 * 60_000)) {
    return apiError(429, "rate_limited", "map.rateLimited", undefined, { request });
  }
  // refuse a body that is far too large before reading it
  if (Number(request.headers.get("content-length") ?? 0) > MAX_MAP_UPLOAD_BYTES + 512 * 1024) {
    return apiError(413, "too_large", "map.imageTooLarge", undefined, { request });
  }

  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return apiError(400, "invalid_request", "map.imageInvalid", undefined, { request });
    const path = await storeMapImage(user.id, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ path, url: mapImageUrl(path) }, { status: 201 });
  } catch (err) {
    if (err instanceof MapImageError) {
      if (err.code === "too_large") return apiError(413, "too_large", "map.imageTooLarge", undefined, { request });
      if (err.code === "storage") return apiError(500, "storage_failed", "map.imageFailed", undefined, { request });
      return apiError(422, "invalid_image", "map.imageInvalid", undefined, { request });
    }
    console.error("POST /api/map/images failed:", err);
    return apiError(500, "internal_error", "map.imageFailed", undefined, { request });
  }
}
