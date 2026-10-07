import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONTENT_IMAGES_BUCKET, uploadedImagePrefix } from "./images";
import { slugify } from "./model";

/**
 * Pictures uploaded from the content editor (/api/admin/content/images).
 * Server-only; called after requireAdmin().
 *
 * Every upload is decoded and re-encoded rather than stored as sent:
 *  - only real JPEG, PNG, WebP and AVIF pictures get through (checked by their
 *    first bytes, not by the name or the type the browser claims);
 *  - EXIF data is dropped - a phone photo's GPS position never goes public -
 *    after the picture has been turned the right way up;
 *  - it is scaled down to at most 2400 px wide and saved as WebP, so a 12 MB
 *    camera file becomes a few hundred kB;
 *  - a decompression bomb (a tiny file that unpacks to billions of pixels) is
 *    refused by sharp's pixel limit.
 * The stored name is generated (date, a slug of the original name, random
 * suffix), so an upload can never overwrite another picture.
 */

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_WIDTH = 2400;
const MAX_INPUT_PIXELS = 60_000_000;

export class ImageUploadError extends Error {
  constructor(
    readonly code: "unsupported_type" | "too_large" | "unreadable" | "storage" | "missing_bucket",
    message: string,
  ) {
    super(message);
  }
}

/** The picture format from its first bytes, or null. */
export function sniffImageType(bytes: Uint8Array): "jpeg" | "png" | "webp" | "avif" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && ascii(1, 4) === "PNG" && bytes[0] === 0x89) return "png";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "avif";
  return null;
}

/** Turns an upload into a clean WebP: upright, at most 2400 px wide, without metadata. */
export async function prepareImage(bytes: Uint8Array): Promise<{ data: Buffer; width: number; height: number }> {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new ImageUploadError("too_large", "Bilden är för stor (högst 12 MB).");
  if (!sniffImageType(bytes)) throw new ImageUploadError("unsupported_type", "Välj en JPEG-, PNG-, WebP- eller AVIF-bild.");
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw new ImageUploadError("unreadable", "Bilden gick inte att läsa. Prova att spara om den som JPEG.");
  }
}

/** A stored name: "2026-10-07-strandvagen-i-solsken-3f9a1c2b.webp". */
export function storedImageName(originalName: string, now = new Date()): string {
  const base = slugify(originalName.replace(/\.[A-Za-z0-9]+$/, "")).slice(0, 60) || "bild";
  return `${now.toISOString().slice(0, 10)}-${base}-${randomBytes(4).toString("hex")}.webp`;
}

export interface UploadedImage {
  src: string;
  label: string;
  createdAt: string | null;
}

export async function uploadContentImage(bytes: Uint8Array, originalName: string): Promise<UploadedImage & { width: number; height: number }> {
  const prefix = uploadedImagePrefix();
  if (!prefix) throw new ImageUploadError("storage", "Supabase är inte inställt.");
  const { data, width, height } = await prepareImage(bytes);
  const name = storedImageName(originalName);
  const { error } = await createAdminClient()
    .storage.from(CONTENT_IMAGES_BUCKET)
    .upload(name, data, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new ImageUploadError("missing_bucket", "Bildlagringen finns inte ännu. Kör migreringen 20261007120000_content_items.sql i Supabase.");
    }
    throw new ImageUploadError("storage", error.message);
  }
  return { src: `${prefix}${name}`, label: originalName || name, createdAt: new Date().toISOString(), width, height };
}

/** The latest uploads, newest first. */
export async function listUploadedImages(limit = 100): Promise<UploadedImage[]> {
  const prefix = uploadedImagePrefix();
  if (!prefix) return [];
  const { data, error } = await createAdminClient()
    .storage.from(CONTENT_IMAGES_BUCKET)
    .list("", { limit, sortBy: { column: "created_at", order: "desc" } });
  if (error || !data) return [];
  return data
    .filter((file) => file.name.endsWith(".webp"))
    .map((file) => ({ src: `${prefix}${file.name}`, label: file.name, createdAt: file.created_at ?? null }));
}
