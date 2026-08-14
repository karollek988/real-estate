import Link from "next/link";
import { LockIcon } from "@/components/icons";
import { UnlockButton } from "./UnlockButton";
import type { AnalysisType } from "@/lib/analysis/ownership";

/**
 * Per-chapter/per-widget paywall teaser, rendered in place of a locked
 * chapter's real content — never alongside it. Two CTAs depending on why the
 * viewer is locked out: an already-purchased-but-unpaid Premium analysis can
 * be unlocked directly (UnlockButton, existing Stripe "unlock this analysis"
 * flow); a free-tier or no-entitlement viewer has no premium analysis_requests
 * row to flip, so they're pointed at the existing upgrade/purchase page instead.
 */
export function PaywallSection({
  title,
  description,
  analysisId,
  analysisType,
  unlocked,
  compact = false,
}: {
  title: string;
  description: string;
  analysisId: string;
  analysisType: AnalysisType | null;
  unlocked: boolean;
  compact?: boolean;
}) {
  const isUnpaidPremium = analysisType === "premium" && !unlocked;

  return (
    <div
      className={`relative flex flex-col items-center gap-4 rounded-md border border-[#B98A2E]/25 bg-[#B98A2E]/[0.04] text-center ${
        compact ? "px-6 py-8" : "px-8 py-12"
      }`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#B98A2E]/10 text-[#B98A2E]">
        <LockIcon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-[#12271D]">{title}</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-[#5B5648]">{description}</p>
      </div>
      {isUnpaidPremium ? (
        <UnlockButton analysisId={analysisId} />
      ) : (
        <Link
          href="/buy"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#12271D] px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#0E2B1F]"
        >
          Uppgradera till Premium
        </Link>
      )}
    </div>
  );
}
