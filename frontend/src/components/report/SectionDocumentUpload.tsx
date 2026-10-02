"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface SectionDocumentUploadProps {
  /**
   * Base API route for this upload. Must expose:
   *   - POST `${endpoint}/upload-url` — body `{ filename, mimeType, size }`,
   *     responds `{ bucket, path, token }` for a Supabase Storage signed
   *     upload URL (see api/properties/[id]/brf-report/upload-url/route.ts
   *     for the reference implementation).
   *   - POST `${endpoint}` — body `{ stagingPath, filename, mimeType }` once
   *     the browser has PUT the file to that signed URL. Must extract the
   *     document, re-run the analysis pipeline, and respond with
   *     `{ analysisId: string }` on success — see
   *     api/properties/[id]/brf-report/route.ts for the reference contract.
   */
  endpoint: string;
  label: string;
  accept: string;
  description?: string;
  /** Rejected client-side before even requesting an upload URL, so a huge
   * file fails fast with a clear message instead of a slow round trip. */
  maxSizeBytes?: number;
}

/**
 * Generic "upload a document into this report section → extract →
 * regenerate analysis" action. The file itself goes straight from the
 * browser into Supabase Storage via a short-lived signed upload URL — never
 * through this app's own API routes — because Vercel Functions cap request
 * bodies at 4.5MB, well under what a real multi-page or scanned report
 * needs. This component only owns the file picker, in-flight/error state,
 * and navigating to the freshly regenerated analysis on success; all the
 * real work (extraction, re-running the analysis) happens server-side once
 * it hands off the uploaded object's storage path to `endpoint`. A hard
 * navigation (not router.push) is deliberate: this must show the truly
 * regenerated report, not a stale client-cached one, and the analysisId
 * returned may or may not differ from the current one depending on how the
 * endpoint versions its rerun.
 *
 * To wire up a new section later: add routes following the same two-step
 * contract (see SectionDocumentUploadProps.endpoint), then drop this
 * component into that chapter with the new `endpoint` — no changes needed
 * here.
 */
export function SectionDocumentUpload({
  endpoint,
  label,
  accept,
  description,
  maxSizeBytes,
}: SectionDocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function parseErrorBody(res: Response): Promise<{ message: string | null; raw: string }> {
    const raw = await res.text();
    try {
      const parsed = JSON.parse(raw);
      return { message: typeof parsed?.error?.message === "string" ? parsed.error.message : null, raw };
    } catch {
      return { message: null, raw };
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);

    const fileInfo = { name: file.name, type: file.type, size: file.size };

    if (typeof maxSizeBytes === "number" && file.size > maxSizeBytes) {
      console.error("SectionDocumentUpload: file rejected client-side (too large)", {
        endpoint,
        file: fileInfo,
        maxSizeBytes,
      });
      setError(`Filen är för stor (max ${Math.floor(maxSizeBytes / (1024 * 1024))} MB).`);
      setUploading(false);
      return;
    }

    try {
      // Step 1: ask our API for a short-lived signed upload URL rather than
      // sending the file to it directly.
      const urlRes = await fetch(`${endpoint}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
      });
      if (!urlRes.ok) {
        const { message, raw } = await parseErrorBody(urlRes);
        console.error("SectionDocumentUpload: upload-url request failed", {
          endpoint,
          file: fileInfo,
          status: urlRes.status,
          body: raw,
        });
        setError(message ?? "Något gick fel vid uppladdningen. Försök igen.");
        setUploading(false);
        return;
      }
      const { bucket, path, token } = await urlRes.json();

      // Step 2: upload the actual bytes straight into Storage, bypassing
      // our own API entirely for the file content.
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
      if (uploadError) {
        console.error("SectionDocumentUpload: direct Storage upload failed", {
          endpoint,
          file: fileInfo,
          bucket,
          path,
          error: uploadError,
        });
        setError("Något gick fel vid uppladdningen. Försök igen.");
        setUploading(false);
        return;
      }

      // Step 3: tell our API the upload is ready to be picked up, extracted,
      // and turned into a re-run of the analysis.
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stagingPath: path, filename: file.name, mimeType: file.type }),
      });
      if (!res.ok) {
        const { message, raw } = await parseErrorBody(res);
        console.error("SectionDocumentUpload: processing request failed", {
          endpoint,
          file: fileInfo,
          status: res.status,
          body: raw,
        });
        setError(message ?? "Något gick fel vid uppladdningen. Försök igen.");
        setUploading(false);
        return;
      }

      const data = await res.json().catch(() => null);
      if (typeof data?.analysisId === "string") {
        // The endpoint only starts the re-run and returns a *pending*
        // analysis (pipeline.ts's startPipelineInBackground finishes the
        // actual work after the response via after()) — going straight to
        // /report would hit it before it's complete and show a false
        // failure. /analyzing polls until the analysis is actually done,
        // exactly like UpdateAnalysisButton's own redirect.
        window.location.href = `/analyzing?id=${data.analysisId}`;
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error("SectionDocumentUpload: unexpected error during upload", {
        endpoint,
        file: fileInfo,
        error: err,
      });
      setError("Något gick fel vid uppladdningen. Försök igen.");
      setUploading(false);
    }
  }

  return (
    <div className="no-print relative mt-4 rounded-md border border-dashed border-black/[0.12] bg-black/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[#12271D]">{label}</p>
          {description && <p className="mt-0.5 text-[11.5px] text-[#8C8471]">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 rounded-sm border border-[#12271D]/20 px-3.5 py-1.5 text-xs font-semibold text-[#12271D] transition hover:bg-[#12271D]/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Laddar upp och uppdaterar…" : "Ladda upp dokument"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      {error && <p className="mt-2 text-xs text-[#A2432F]">{error}</p>}
    </div>
  );
}
