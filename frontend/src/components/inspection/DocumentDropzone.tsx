"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UploadCloudIcon, ClipboardIcon } from "@/components/icons";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/inspection/types";

const RECOMMENDED: DocumentType[] = ["annual_report", "maintenance_plan", "bylaws"];

export function DocumentDropzone({
  onUpload,
  defaultDocType = "other",
}: {
  onUpload: (file: File, docType: DocumentType) => Promise<string | null>;
  defaultDocType?: DocumentType;
}) {
  const t = useTranslations("inspection.dropzone");
  const tDocuments = useTranslations("inspection.documents");
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
        {DOCUMENT_TYPES.filter((type) => type !== "other").map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setDocType(type)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              docType === type
                ? "border-ka-green-700/40 bg-ka-sage/60 text-ka-green-700"
                : "border-ka-line-strong bg-ka-cream text-ka-text hover:border-ka-line-strong"
            }`}
          >
            {tDocuments(type)}
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
          dragOver ? "border-ka-green-700 bg-ka-sage/40" : "border-ka-line-strong bg-ka-cream"
        }`}
      >
        <UploadCloudIcon className="h-8 w-8 text-ka-muted" />
        <div>
          <p className="text-sm text-ka-text">{t("drop")}</p>
          <p className="mt-0.5 text-xs text-ka-muted">{t("or")}</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-xl bg-ka-green-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ka-green-800 disabled:opacity-60"
        >
          {uploading ? t("uploading") : t("choose")}
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
      {error && <p className="text-sm text-ka-red-600">{error}</p>}

      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-ka-muted">
          <ClipboardIcon className="h-3.5 w-3.5" />
          {t("recommended")}
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-ka-muted">
          {RECOMMENDED.map((type) => (
            <span key={type}>{t("pdf", { name: tDocuments(type) })}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
