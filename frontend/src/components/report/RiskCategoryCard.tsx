import type { RiskCategory } from "@/lib/report/build";

/**
 * Presents each risk category as a factual observation, not a rated verdict
 * — no severity chip/color, no numeric score. When there simply isn't
 * enough data ("unknown"), that's stated plainly instead of implying a risk
 * level either way.
 */
export function RiskCategoryCard({ risk, icon }: { risk: RiskCategory; icon: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-md border border-black/[0.08] bg-white/60 p-5 last:mb-0">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#A2432F]/[0.08] text-[#A2432F]">
          {icon}
        </span>
        <div>
          <h3 className="text-[16px] font-semibold tracking-tight text-[#12271D]">{risk.label}</h3>
          <p className="text-[13px] font-medium text-[#8C8471]">{risk.headline}</p>
        </div>
      </div>
      <p className="mt-3 text-[14.5px] leading-relaxed text-[#3A362C]">{risk.explanation}</p>
      {risk.evidence.length > 0 && (
        <ul className="mt-3 space-y-1 border-l-2 border-[#A2432F]/25 pl-3">
          {risk.evidence.map((e, i) => (
            <li key={i} className="text-[13px] leading-relaxed text-[#5B5648]">
              {e}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[14.5px] font-medium text-[#12271D]">{risk.conclusion}</p>
    </div>
  );
}
