import { StatusDot, type DotSeverity } from "./StatusDot";

const BG: Record<DotSeverity, string> = {
  low: "bg-[#4B7A57]/[0.09] text-[#3D6349]",
  medium: "bg-[#B98A2E]/[0.12] text-[#8A6220]",
  high: "bg-[#A2432F]/[0.09] text-[#8C3826]",
  unknown: "bg-black/[0.05] text-[#5B5648]",
};

/** Status pill — dot + label on a tinted background. Used for risk severity
 *  and other categorical reads that were previously bare text. */
export function Chip({ severity, children }: { severity: DotSeverity; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${BG[severity]}`}>
      <StatusDot severity={severity} />
      {children}
    </span>
  );
}
