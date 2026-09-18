"use client";

import { useRef, useState } from "react";

export interface SectionDocumentUploadProps {
  /**
   * API route this posts a "file" FormData field to. Must extract the
   * document, re-run the analysis pipeline, and respond with
   * `{ analysisId: string }` on success — see
   * api/properties/[id]/brf-report/route.ts for the reference contract.
   */
  endpoint: string;
  label: string;
  accept: string;
  description?: string;
}

/**
 * Generic "upload a document into this report section → extract →
 * regenerate analysis" action. All the real work (extraction via the
 * existing OCR/document pipeline, re-running the analysis) happens
 * server-side at `endpoint` — this component only owns the file picker,
 * in-flight/error state, and navigating to the freshly regenerated
 * analysis on success. A hard navigation (not router.push) is deliberate:
 * this must show the truly regenerated report, not a stale client-cached
 * one, and the analysisId returned may or may not differ from the current
 * one depending on how the endpoint versions its rerun.
 *
 * To wire up a new section later: add a route following the same contract
 * (accept a "file" field, extract, call rerunAnalysisForProperty, return
 * { analysisId }), then drop this component into that chapter with the
 * new `endpoint` — no changes needed here.
 */
export function SectionDocumentUpload({ endpoint, label, accept, description }: SectionDocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "Något gick fel vid uppladdningen. Försök igen.");
        setUploading(false);
        return;
      }
      if (typeof data?.analysisId === "string") {
        window.location.href = `/report?id=${data.analysisId}`;
      } else {
        window.location.reload();
      }
    } catch {
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
