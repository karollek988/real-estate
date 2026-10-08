"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";
import { ManualEntryForm } from "./ManualEntryForm";
import { ArrowRightIcon, CloseIcon, UploadCloudIcon } from "./icons";
import type { ManualListingFields } from "@/lib/analysis/listing/manual";

const MAX_FILES = 6;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_MB = MAX_FILE_BYTES / 1024 / 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

interface Extraction {
  fields: Partial<ManualListingFields>;
  foundKeys: string[];
  texts: string[];
}

/**
 * Upload one or more listing screenshots -> OCR -> pre-filled review form.
 * Nothing here is stored anywhere: files stay as in-memory File objects
 * until the extract request completes, then only the extracted text fields
 * (never the images) are kept in state for the review step below.
 */
export function ScreenshotUploadForm() {
  const t = useTranslations("forms.screenshot");
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
        setError(t("errors.fileType"));
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(t("errors.fileSize", { maxMb: MAX_MB }));
        continue;
      }
      combined.push(file);
    }

    if (combined.length > MAX_FILES) {
      setError(t("errors.tooMany", { maxFiles: MAX_FILES }));
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
        setError(data?.error?.message ?? t("errors.generic"));
        setUploading(false);
        return;
      }

      setExtraction({ fields: data.fields ?? {}, foundKeys: data.foundKeys ?? [], texts: data.texts ?? [] });
    } catch {
      setError(t("errors.generic"));
    } finally {
      setUploading(false);
    }
  }

  if (extraction) {
    const foundCount = extraction.foundKeys.length;
    return (
      <div className="flex flex-col gap-4">
        {extraction.texts.length > 0 && (
          <details className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60">
            <summary className="cursor-pointer select-none font-medium text-white/80">
              {t("ocrDebug")}
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-white/60">
              {extraction.texts.join("\n\n---\n\n")}
            </pre>
          </details>
        )}
        <ManualEntryForm
          initialValues={extraction.fields}
          sourceNotice={
            foundCount > 0 ? t("foundNotice", { count: foundCount }) : t("nothingFoundNotice")
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-10 text-center transition hover:border-ka-mint/40 hover:bg-white/[0.04]"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-ka-mint">
          <UploadCloudIcon className="h-5 w-5" />
        </span>
        <span className="text-[15px] font-semibold text-white">{t("dropTitle")}</span>
        <span className="max-w-xs text-sm text-white/60">
          {t("dropHint", { maxFiles: MAX_FILES, maxMb: MAX_MB })}
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
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 py-1.5 pl-3 pr-1.5 text-xs text-white/80"
            >
              <span className="max-w-[140px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label={t("removeFile", { name: file.name })}
                className="flex h-5 w-5 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-ka-coral-300">{error}</p>}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={handleExtract} disabled={files.length === 0 || uploading} className="self-start">
          {uploading ? t("submitting") : t("submit")}
          <ArrowRightIcon className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={() => setExtraction({ fields: {}, foundKeys: [], texts: [] })}
          className="text-sm font-medium text-white/60 underline-offset-4 hover:text-white hover:underline"
        >
          {t("manualInstead")}
        </button>
      </div>
    </div>
  );
}
