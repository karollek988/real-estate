"use client";

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
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !gap.resolvableByDocType) return;
    await onUpload(file, gap.resolvableByDocType);
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        gap.missing ? "border-amber-400/20 bg-amber-400/[0.04]" : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            gap.missing ? "bg-amber-400/10 text-amber-400" : "bg-green-400/10 text-green-400"
          }`}
        >
          {gap.missing ? <WarningIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
        </span>
        <div>
          <p className="text-sm font-medium text-white">{gap.label}</p>
          <p className="text-xs text-neutral-400">
            {gap.missing ? "Saknas — ladda upp underlag för att stärka analysen." : gap.knownValue}
          </p>
        </div>
      </div>
      {gap.missing && gap.resolvableByDocType && (
        <label className="shrink-0 cursor-pointer rounded-lg border border-amber-400/30 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/10">
          Ladda upp
          <input type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFile} />
        </label>
      )}
    </div>
  );
}
