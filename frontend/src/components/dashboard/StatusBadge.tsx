import { useTranslations } from "next-intl";

type Status = "ready" | "processing" | "expired";

const STATUS_STYLES: Record<Status, string> = {
  ready: "bg-green-400/10 text-green-400 border-green-400/20",
  processing: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  expired: "bg-white/5 text-neutral-400 border-white/10",
};

export function StatusBadge({ status }: { status: Status }) {
  const t = useTranslations("dashboard.analysis.status");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-tight ${STATUS_STYLES[status]}`}
    >
      {t(status)}
    </span>
  );
}
