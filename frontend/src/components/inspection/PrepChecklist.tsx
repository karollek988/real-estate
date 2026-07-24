"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { PREP_STEPS, type PrepChecklistState } from "@/lib/inspection/types";

export function PrepChecklist({
  state,
  onToggle,
}: {
  state: PrepChecklistState;
  onToggle: (stepId: string, checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(PREP_STEPS[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-2.5">
      {PREP_STEPS.map((step) => {
        const checked = state[step.id] ?? false;
        const open = expanded === step.id;
        return (
          <div
            key={step.id}
            className="rounded-xl border border-white/10 bg-black/20 transition hover:border-white/20"
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <button
                type="button"
                onClick={() => onToggle(step.id, !checked)}
                aria-label={checked ? "Markera som ej klar" : "Markera som klar"}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                  checked ? "border-green-500 bg-green-500 text-white" : "border-white/20 text-transparent"
                }`}
              >
                <CheckIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : step.id)}
                className="flex flex-1 items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-white">
                    {step.order}. {step.title}
                  </p>
                  {!open && <p className="mt-0.5 truncate text-xs text-neutral-500">{step.description}</p>}
                </div>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            {open && <p className="px-4 pb-3.5 pl-[52px] text-sm text-neutral-400">{step.description}</p>}
          </div>
        );
      })}
    </div>
  );
}
