"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, QuestionIcon } from "@/components/icons";
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
            {open && (
              <div className="px-4 pb-4 pl-[52px]">
                <p className="text-sm text-neutral-400">{step.description}</p>
                {step.items.length > 0 && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-400">
                      <QuestionIcon className="h-3.5 w-3.5 shrink-0" />
                      Vad du behöver
                    </p>
                    <ul className="mt-2.5 flex flex-col gap-2.5">
                      {step.items.map((item) => (
                        <li key={item.name} className="text-sm">
                          <p className="font-medium text-white">{item.name}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400">{item.whereToFind}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
