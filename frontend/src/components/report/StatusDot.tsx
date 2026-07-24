export type DotSeverity = "low" | "medium" | "high" | "unknown";

const COLOR: Record<DotSeverity, string> = {
  low: "bg-[#4B7A57]",
  medium: "bg-[#B98A2E]",
  high: "bg-[#A2432F]",
  unknown: "bg-[#B9B2A2]",
};

export function StatusDot({ severity }: { severity: DotSeverity }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${COLOR[severity]}`} />;
}
