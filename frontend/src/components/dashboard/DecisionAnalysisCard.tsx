import { CalendarIcon, TrendingUpIcon, HouseIcon, ArrowRightIcon } from "@/components/icons";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

interface DecisionAnalysisCardProps {
  address: string;
  analysisDate: string;
  fairPrice: string;
  status: "ready" | "processing" | "expired";
  growthPct?: number;
  onOpen?: () => void;
  /** Secondary actions (e.g. upload/delete) that belong to this analysis —
   *  rendered inside the same card, below a divider. */
  footer?: React.ReactNode;
}

export function DecisionAnalysisCard({
  address,
  analysisDate,
  fairPrice,
  status,
  growthPct,
  onOpen,
  footer,
}: DecisionAnalysisCardProps) {
  const growthPositive = (growthPct ?? 0) >= 0;

  return (
    <div className="card-interactive flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0F1417]/85 p-4 backdrop-blur-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/10 to-white/[0.02] text-neutral-400">
          <HouseIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{address}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <CalendarIcon className="h-3.5 w-3.5" />
            {analysisDate}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-5 sm:justify-end sm:gap-6">
        <div className="text-right">
          <p className="text-xs text-neutral-400">Marknadsvärde</p>
          <p className="text-sm font-semibold text-white">{fairPrice}</p>
        </div>

        {growthPct !== undefined && (
          <div className="text-right">
            <p
              className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                growthPositive ? "text-green-400" : "text-amber-400"
              }`}
            >
              {growthPositive ? "+" : ""}
              {growthPct}%
              <TrendingUpIcon className={`h-3.5 w-3.5 ${growthPositive ? "" : "rotate-90"}`} />
            </p>
            <p className="text-xs text-neutral-500">vs marknad</p>
          </div>
        )}

        <StatusBadge status={status} />

        <button
          type="button"
          onClick={onOpen}
          className="hidden shrink-0 items-center gap-1 text-xs font-medium text-green-400 transition hover:text-green-300 sm:flex"
        >
          Öppna analys
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      </div>

      {footer && <div className="flex flex-col gap-1 border-t border-white/10 pt-3">{footer}</div>}
    </div>
  );
}
