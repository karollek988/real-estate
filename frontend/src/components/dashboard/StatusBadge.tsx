type Status = "ready" | "processing" | "expired";

const STATUS_STYLES: Record<Status, string> = {
  ready: "bg-green-400/10 text-green-400 border-green-400/20",
  processing: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  expired: "bg-white/5 text-neutral-400 border-white/10",
};

const STATUS_LABELS: Record<Status, string> = {
  ready: "Ready",
  processing: "Processing",
  expired: "Expired",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-tight ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
