import { createClient } from "@/lib/supabase/client";
import { MAX_BRF_REPORT_BYTES } from "./uploadLimits";

/**
 * Browser side of the annual-report upload, shared by the report chapter, the
 * dashboard and the review console. Three steps, because Vercel Functions cap
 * request bodies at 4.5 MB — far below a scanned multi-page report:
 *
 *   1. POST /api/properties/:id/brf-report/upload-url → a short-lived signed Storage URL
 *   2. PUT the file straight into Storage with it
 *   3. POST /api/properties/:id/brf-report → the server picks the file up, reads it and
 *      hands it to the BRF review (lib/brf/reviews.ts)
 */

export type BrfUploadResult =
  | { ok: true; dueAt: string | null; extracted: boolean }
  | { ok: false; message: string };

const GENERIC_ERROR = "Något gick fel vid uppladdningen. Försök igen.";

async function errorMessage(res: Response): Promise<{ message: string | null; raw: string }> {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw);
    return { message: typeof parsed?.error?.message === "string" ? parsed.error.message : null, raw };
  } catch {
    return { message: null, raw };
  }
}

export async function uploadBrfAnnualReport(propertyId: string, file: File): Promise<BrfUploadResult> {
  const endpoint = `/api/properties/${propertyId}/brf-report`;
  const fileInfo = { name: file.name, type: file.type, size: file.size };

  if (file.size > MAX_BRF_REPORT_BYTES) {
    return { ok: false, message: `Filen är för stor (max ${Math.floor(MAX_BRF_REPORT_BYTES / (1024 * 1024))} MB).` };
  }

  try {
    const urlRes = await fetch(`${endpoint}/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
    });
    if (!urlRes.ok) {
      const { message, raw } = await errorMessage(urlRes);
      console.error("uploadBrfAnnualReport: upload-url request failed", { endpoint, file: fileInfo, status: urlRes.status, body: raw });
      return { ok: false, message: message ?? GENERIC_ERROR };
    }
    const { bucket, path, token } = await urlRes.json();

    const { error: uploadError } = await createClient()
      .storage.from(bucket)
      .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
    if (uploadError) {
      console.error("uploadBrfAnnualReport: direct Storage upload failed", { endpoint, file: fileInfo, bucket, path, error: uploadError });
      return { ok: false, message: GENERIC_ERROR };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stagingPath: path, filename: file.name, mimeType: file.type }),
    });
    if (!res.ok) {
      const { message, raw } = await errorMessage(res);
      console.error("uploadBrfAnnualReport: processing request failed", { endpoint, file: fileInfo, status: res.status, body: raw });
      return { ok: false, message: message ?? GENERIC_ERROR };
    }
    const data = (await res.json().catch(() => null)) as { review?: { dueAt?: string | null }; extracted?: boolean } | null;
    return { ok: true, dueAt: data?.review?.dueAt ?? null, extracted: data?.extracted === true };
  } catch (err) {
    console.error("uploadBrfAnnualReport: unexpected error", { endpoint, file: fileInfo, error: err });
    return { ok: false, message: GENERIC_ERROR };
  }
}
