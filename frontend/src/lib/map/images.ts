import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffImageType } from "@/lib/content/imageUpload";

/**
 * Pictures of map pins. The browser shrinks a photo before it sends it; the server does not trust that: it checks the
 * first bytes (not the name or the type the browser claims), turns the picture upright, drops its metadata - a phone
 * photo's GPS position never goes public - scales it to at most 1280 px and stores it as WebP in the public bucket
 * "map-listing-images" under the owner's own folder. A decompression bomb is refused by sharp's pixel limit.
 */

export const MAP_IMAGES_BUCKET = "map-listing-images";
/** What the server accepts as an upload; the browser sends well under a megabyte. */
export const MAX_MAP_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_WIDTH = 1280;
const MAX_INPUT_PIXELS = 40_000_000;

export class MapImageError extends Error {
  constructor(readonly code: "unsupported_type" | "too_large" | "unreadable" | "storage") {
    super(code);
  }
}

/** Where a stored picture is served from: https://<project>.supabase.co/storage/v1/object/public/map-listing-images/<path> */
export function mapImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https:\/\//.test(path)) return path; // the built-in examples
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base.replace(/\/$/, "")}/storage/v1/object/public/${MAP_IMAGES_BUCKET}/${path}` : null;
}

/** Stores an upload for `ownerId` and returns its path in the bucket ("<owner id>/<name>.webp"). */
export async function storeMapImage(ownerId: string, bytes: Uint8Array): Promise<string> {
  if (bytes.length > MAX_MAP_UPLOAD_BYTES) throw new MapImageError("too_large");
  if (!sniffImageType(bytes)) throw new MapImageError("unsupported_type");
  let data: Buffer;
  try {
    data = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: MAX_WIDTH, height: MAX_WIDTH, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new MapImageError("unreadable");
  }
  const path = `${ownerId}/${randomBytes(8).toString("hex")}.webp`;
  const { error } = await createAdminClient()
    .storage.from(MAP_IMAGES_BUCKET)
    .upload(path, data, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) {
    console.error("map listing picture could not be stored:", error.message);
    throw new MapImageError("storage");
  }
  return path;
}

/** Removes a picture from the bucket; a failure is only logged (an orphan costs nothing but space). */
export async function removeMapImage(path: string | null): Promise<void> {
  if (!path || /^https:\/\//.test(path)) return;
  const { error } = await createAdminClient().storage.from(MAP_IMAGES_BUCKET).remove([path]);
  if (error) console.error("map listing picture could not be removed:", error.message);
}
