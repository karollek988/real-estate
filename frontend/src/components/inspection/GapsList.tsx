"use client";

import { useTranslations } from "next-intl";
import { CheckIcon, WarningIcon } from "@/components/icons";
import type { DocumentType } from "@/lib/inspection/types";
import type { DataGap } from "@/lib/inspection/gaps";

/** PART 5 — "if the analysis already knows something show it, if missing highlight it + let them upload." */
export function GapsList({
  gaps,
  onUpload,
}: {
  gaps: DataGap[];
  onUpload: (file: File, docType: DocumentType) => Promise<string | null>;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {gaps.map((gap) => (
        <GapRow key={gap.id} gap={gap} onUpload={onUpload} />
      ))}
    </div>
  );
}

function GapRow({
  gap,
  onUpload,
}: {
  gap: DataGap;
  onUpload: (file: File, docType: DocumentType) => Promise<string | null>;
}) {
  const t = useTranslations("inspection.gaps");
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !gap.resolvableByDocType) return;
    await onUpload(file, gap.resolvableByDocType);
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        gap.missing ? "border-ka-amber-300 bg-ka-amber-100" : "border-ka-line-strong bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            gap.missing ? "bg-ka-amber-100 text-ka-amber-700" : "bg-ka-sage/60 text-ka-green-700"
          }`}
        >
          {gap.missing ? <WarningIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
        </span>
        <div>
          <p className="text-sm font-medium text-ka-ink">{t(gap.id)}</p>
          <p className="text-xs text-ka-muted">
            {gap.missing ? t("missing") : gap.known ? t(`known.${gap.known}`) : gap.knownValue}
          </p>
        </div>
      </div>
      {gap.missing && gap.resolvableByDocType && (
        <label className="shrink-0 cursor-pointer rounded-lg border border-ka-amber-300 px-3 py-1.5 text-xs font-semibold text-ka-amber-700 transition hover:bg-ka-amber-100">
          {t("upload")}
          <input type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />
        </label>
      )}
    </div>
  );
}
