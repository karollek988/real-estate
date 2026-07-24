import type { RiskCategory } from "@/lib/report/build";
import { Chip } from "./Chip";

const SEVERITY_LABEL_SV: Record<RiskCategory["severity"], string> = {
  low: "Låg risk",
  medium: "Måttlig risk",
  high: "Förhöjd risk",
  unknown: "Kan ej bedömas",
};

export function RiskCategoryCard({ risk, icon }: { risk: RiskCategory; icon: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-md border border-black/[0.08] bg-white/60 p-5 last:mb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#12271D]/[0.06] text-[#12271D]">
            {icon}
          </span>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-[#12271D]">{risk.label}</h3>
            <p className="text-[12.5px] font-medium text-[#8C8471]">{risk.headline}</p>
          </div>
        </div>
        <Chip severity={risk.severity}>{SEVERITY_LABEL_SV[risk.severity]}</Chip>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-[#3A362C]">{risk.explanation}</p>
      {risk.evidence.length > 0 && (
        <ul className="mt-3 space-y-1 border-l-2 border-[#B98A2E]/30 pl-3">
          {risk.evidence.map((e, i) => (
            <li key={i} className="text-[12.5px] leading-relaxed text-[#5B5648]">
              {e}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[13.5px] font-medium text-[#12271D]">{risk.conclusion}</p>
    </div>
  );
}
