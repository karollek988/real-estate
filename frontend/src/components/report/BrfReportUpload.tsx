"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { uploadBrfAnnualReport } from "@/lib/brf/uploadClient";
import { BRF_REPORT_ACCEPT } from "@/lib/brf/uploadLimits";

/**
 * "Upload the association's annual report" — in the report's BRF chapter and
 * in the review console. The upload goes to the person-reviewed BRF analysis
 * (lib/brf/reviews.ts); nothing is re-analysed automatically, so on success
 * this just confirms receipt and refreshes the page.
 */
export function BrfReportUpload({
  propertyId,
  label,
  description,
  successMessage,
  tone = "report",
}: {
  propertyId: string;
  label: string;
  description?: string;
  successMessage?: string;
  tone?: "report" | "admin";
}) {
  const t = useTranslations("brf.analysis.upload");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setDone(false);
    const result = await uploadBrfAnnualReport(propertyId, file);
    setUploading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(true);
    router.refresh();
  }

  const box =
    tone === "admin"
      ? "rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4"
      : "no-print relative mt-4 rounded-md border border-dashed border-black/[0.14] bg-white/60 p-4";

  return (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[#12271D]">{label}</p>
          {description && <p className="mt-0.5 text-[11.5px] text-[#8C8471]">{description}</p>}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 rounded-sm border border-[#12271D]/20 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#12271D] transition hover:bg-[#12271D]/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? t("uploading") : t("button")}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={BRF_REPORT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      {uploading && (
        <p className="mt-2 text-xs text-[#5B5648]">{t("reading")}</p>
      )}
      {done && <p className="mt-2 text-xs font-medium text-[#3D6A49]">{successMessage ?? t("success")}</p>}
      {error && <p className="mt-2 text-xs text-[#A2432F]">{error}</p>}
    </div>
  );
}
