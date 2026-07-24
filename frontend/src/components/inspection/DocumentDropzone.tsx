"use client";

import { useRef, useState } from "react";
import { UploadCloudIcon, ClipboardIcon } from "@/components/icons";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/inspection/types";

const RECOMMENDED: DocumentType[] = ["annual_report", "maintenance_plan", "bylaws"];

export function DocumentDropzone({
  onUpload,
  defaultDocType = "other",
}: {
  onUpload: (file: File, docType: DocumentType) => Promise<string | null>;
  defaultDocType?: DocumentType;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocumentType>(defaultDocType);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const err = await onUpload(file, docType);
    setError(err);
    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[])
          .filter((t) => t !== "other")
          .map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDocType(t)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                docType === t
                  ? "border-green-500/50 bg-green-400/10 text-green-400"
                  : "border-white/10 bg-white/5 text-neutral-300 hover:border-white/20"
              }`}
            >
              {DOCUMENT_TYPE_LABELS[t]}
            </button>
          ))}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragOver ? "border-green-500/60 bg-green-400/[0.04]" : "border-white/10 bg-black/20"
        }`}
      >
        <UploadCloudIcon className="h-8 w-8 text-neutral-500" />
        <div>
          <p className="text-sm text-neutral-300">Dra och släpp filer här</p>
          <p className="mt-0.5 text-xs text-neutral-500">eller</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-60"
        >
          {uploading ? "Laddar upp..." : "Välj filer"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <ClipboardIcon className="h-3.5 w-3.5" />
          Rekommenderade dokument
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-neutral-400">
          {RECOMMENDED.map((t) => (
            <span key={t}>{DOCUMENT_TYPE_LABELS[t]} (PDF)</span>
          ))}
        </div>
      </div>
    </div>
  );
}
