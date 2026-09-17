"use client";

import { useRef, useState } from "react";
import { Button } from "./Button";
import { ManualEntryForm } from "./ManualEntryForm";
import { ArrowRightIcon, CloseIcon, UploadCloudIcon } from "./icons";
import type { ManualListingFields } from "@/lib/analysis/listing/manual";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

interface Extraction {
  fields: Partial<ManualListingFields>;
  foundKeys: string[];
}

/**
 * Upload one or more listing screenshots -> OCR -> pre-filled review form.
 * Nothing here is stored anywhere: files stay as in-memory File objects
 * until the extract request completes, then only the extracted text fields
 * (never the images) are kept in state for the review step below.
 */
export function ScreenshotUploadForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;
    setError(null);

    const combined = [...files];
    for (const file of Array.from(newFiles)) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        setError("Endast PNG-, JPEG- eller WEBP-bilder stöds.");
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError("Varje bild får vara max 8 MB.");
        continue;
      }
      combined.push(file);
    }

    if (combined.length > MAX_FILES) {
      setError(`Max ${MAX_FILES} bilder åt gången.`);
      setFiles(combined.slice(0, MAX_FILES));
    } else {
      setFiles(combined);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleExtract() {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    setError(null);

    try {
      const fd = new FormData();
      for (const file of files) fd.append("files", file);

      const res = await fetch("/api/listing-screenshots/extract", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error?.message ?? "Något gick fel. Försök igen.");
        setUploading(false);
        return;
      }

      setExtraction({ fields: data.fields ?? {}, foundKeys: data.foundKeys ?? [] });
    } catch {
      setError("Något gick fel. Försök igen.");
    } finally {
      setUploading(false);
    }
  }

  if (extraction) {
    const foundCount = extraction.foundKeys.length;
    return (
      <ManualEntryForm
        initialValues={extraction.fields}
        sourceNotice={
          foundCount > 0
            ? `Vi läste av ${foundCount} fält från dina skärmdumpar — kontrollera att de stämmer och fyll i resten.`
            : "Vi kunde inte läsa av några uppgifter automatiskt från bilderna — fyll i formuläret nedan."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center transition hover:border-green-500/40 hover:bg-white/[0.04]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-green-400">
          <UploadCloudIcon className="h-5 w-5" />
        </span>
        <span className="text-[15px] font-semibold text-white">Ladda upp skärmdumpar av annonsen</span>
        <span className="max-w-xs text-sm text-neutral-400">
          PNG, JPEG eller WEBP · upp till {MAX_FILES} bilder · max 8 MB/bild
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-3 pr-1.5 text-xs text-neutral-200"
            >
              <span className="max-w-[140px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label={`Ta bort ${file.name}`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={handleExtract} disabled={files.length === 0 || uploading} className="self-start">
          {uploading ? "Läser av bilder..." : "Läs av bilder"}
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={() => setExtraction({ fields: {}, foundKeys: [] })}
          className="text-sm font-medium text-neutral-400 underline-offset-4 hover:text-neutral-200 hover:underline"
        >
          Fyll i uppgifterna manuellt istället
        </button>
      </div>
    </div>
  );
}
