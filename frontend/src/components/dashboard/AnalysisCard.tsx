import { useTranslations } from "next-intl";
import { CalendarIcon, HouseIcon, ArrowRightIcon } from "@/components/icons";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

interface AnalysisCardProps {
  address: string;
  analysisDate: string;
  planLabel: string;
  status: "ready" | "processing" | "expired";
  onOpen?: () => void;
  /** Secondary actions (e.g. upload/delete) that belong to this analysis —
   *  rendered inside the same card, below a divider. */
  footer?: React.ReactNode;
}

/** One of the customer's analyses on the dashboard: address, date, package and status. */
export function AnalysisCard({ address, analysisDate, planLabel, status, onOpen, footer }: AnalysisCardProps) {
  const t = useTranslations("dashboard.analysis");
  return (
    <div className="card-interactive flex flex-col gap-4 rounded-2xl border border-ka-line-strong bg-white p-4 backdrop-blur-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] text-ka-muted">
          <HouseIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ka-ink">{address}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-ka-muted">
            <CalendarIcon className="h-3.5 w-3.5" />
            {analysisDate}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-5 sm:justify-end sm:gap-6">
        <div className="text-right">
          <p className="text-xs text-ka-muted">{t("type")}</p>
          <p className="text-sm font-semibold text-ka-ink">{planLabel}</p>
        </div>

        <StatusBadge status={status} />

        <button
          type="button"
          onClick={onOpen}
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-ka-green-700 transition hover:text-ka-green-800"
        >
          {t("open")}
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      </div>

      {footer && <div className="flex flex-col gap-1 border-t border-ka-line-strong pt-3">{footer}</div>}
    </div>
  );
}
