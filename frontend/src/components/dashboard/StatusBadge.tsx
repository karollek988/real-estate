import { useTranslations } from "next-intl";

type Status = "ready" | "processing" | "expired";

const STATUS_STYLES: Record<Status, string> = {
  ready: "bg-ka-sage/60 text-ka-green-700 border-ka-green-700/25",
  processing: "bg-ka-amber-100 text-ka-amber-700 border-ka-amber-300",
  expired: "bg-ka-cream text-ka-muted border-ka-line-strong",
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
