"use client";

import { CrownIcon, TicketIcon } from "./icons";

export type AnalysisType = "free" | "premium";

interface AnalysisTypeChoiceProps {
  value: AnalysisType;
  onChange: (value: AnalysisType) => void;
}

const OPTIONS: { value: AnalysisType; label: string; description: string; icon: typeof CrownIcon }[] = [
  {
    value: "premium",
    label: "Premium-analys",
    description: "Fullständigt beslutsunderlag. Drar en Premium-analys.",
    icon: CrownIcon,
  },
  {
    value: "free",
    label: "Gratis-analys",
    description: "Drar en av dina gratisanalyser.",
    icon: TicketIcon,
  },
];

/** Lets the user choose which quota bucket this analysis run should consume. */
export function AnalysisTypeChoice({ value, onChange }: AnalysisTypeChoiceProps) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="Analystyp">
      {OPTIONS.map(({ value: optionValue, label, description, icon: Icon }) => {
        const selected = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(optionValue)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
              selected
                ? "border-green-500/60 bg-green-400/10"
                : "border-white/10 bg-black/40 hover:border-white/20"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                selected ? "border-green-400" : "border-neutral-500"
              }`}
            >
              {selected && <span className="h-2 w-2 rounded-full bg-green-400" />}
            </span>
            <Icon className={`h-4 w-4 shrink-0 ${selected ? "text-green-400" : "text-neutral-500"}`} />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-white">{label}</span>
              <span className="block text-xs text-neutral-400">{description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
