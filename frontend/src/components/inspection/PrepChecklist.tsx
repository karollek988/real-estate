"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, ChevronDownIcon, QuestionIcon } from "@/components/icons";
import { PREP_STEPS, type PrepChecklistState } from "@/lib/inspection/types";

export function PrepChecklist({
  state,
  onToggle,
}: {
  state: PrepChecklistState;
  onToggle: (stepId: string, checked: boolean) => void;
}) {
  const t = useTranslations("inspection.prep");
  const [expanded, setExpanded] = useState<string | null>(PREP_STEPS[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-2.5">
      {PREP_STEPS.map((step) => {
        const checked = state[step.id] ?? false;
        const open = expanded === step.id;
        return (
          <div
            key={step.id}
            className="rounded-xl border border-ka-line-strong bg-ka-cream transition hover:border-ka-green-700/40"
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <button
                type="button"
                onClick={() => onToggle(step.id, !checked)}
                aria-label={checked ? t("markUndone") : t("markDone")}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                  checked ? "border-ka-green-700 bg-ka-green-700 text-white" : "border-ka-line-strong text-transparent"
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
                  <p className="text-sm font-medium text-ka-ink">
                    {step.order}. {t(`${step.id}.title`)}
                  </p>
                  {!open && <p className="mt-0.5 truncate text-xs text-ka-muted">{t(`${step.id}.description`)}</p>}
                </div>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-ka-muted transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            {open && (
              <div className="px-4 pb-4 pl-[52px]">
                <p className="text-sm text-ka-muted">{t(`${step.id}.description`)}</p>
                {step.items.length > 0 && (
                  <div className="mt-3 rounded-lg border border-ka-line-strong bg-ka-cream p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ka-green-700">
                      <QuestionIcon className="h-3.5 w-3.5 shrink-0" />
                      {t("needs")}
                    </p>
                    <ul className="mt-2.5 flex flex-col gap-2.5">
                      {step.items.map((item) => (
                        <li key={item.id} className="text-sm">
                          <p className="font-medium text-ka-ink">{t(`${step.id}.items.${item.id}.name` as never)}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-ka-muted">
                            {t(`${step.id}.items.${item.id}.whereToFind` as never)}
                          </p>
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
