"use client";

import { useTranslations } from "next-intl";

/** The three steps. Their words: inspection.steps.<id>.title / .subtitle */
const STEPS = [
  { step: 1, id: "before" },
  { step: 2, id: "during" },
  { step: 3, id: "after" },
] as const;

export function InspectionStepTabs({
  current,
  furthestUnlocked,
  onSelect,
}: {
  current: number;
  furthestUnlocked: number;
  onSelect: (step: 1 | 2 | 3) => void;
}) {
  const t = useTranslations("inspection.steps");
  return (
    <div className="flex items-center">
      {STEPS.map(({ step, id }, i) => {
        const active = step === current;
        const done = step < current;
        const unlocked = step <= furthestUnlocked;
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              disabled={!unlocked}
              onClick={() => unlocked && onSelect(step as 1 | 2 | 3)}
              className="flex flex-col items-center gap-2 disabled:cursor-not-allowed"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition ${
                  active
                    ? "border-ka-green-700 bg-ka-sage/50 text-ka-green-700"
                    : done
                      ? "border-ka-green-700/40 bg-ka-sage/40 text-ka-green-700"
                      : unlocked
                        ? "border-ka-line-strong text-ka-text"
                        : "border-ka-line-strong text-ka-muted"
                }`}
              >
                {step}
              </span>
              <span className="text-center">
                <span className={`block text-sm font-semibold ${active || done ? "text-ka-ink" : "text-ka-muted"}`}>
                  {t(`${id}.title`)}
                </span>
                <span className="block text-xs text-ka-muted">{t(`${id}.subtitle`)}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="mx-3 mt-[-20px] h-px flex-1 bg-ka-sand">
                <div
                  className="h-px bg-ka-green-700 transition-all"
                  style={{ width: step < current ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
