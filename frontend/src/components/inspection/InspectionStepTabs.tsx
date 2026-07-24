const STEPS = [
  { step: 1, title: "Innan besiktning", subtitle: "Förberedelser & info" },
  { step: 2, title: "Under besiktning", subtitle: "Steg för steg" },
  { step: 3, title: "Efter besiktning", subtitle: "Uppföljning & analys" },
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
  return (
    <div className="flex items-center">
      {STEPS.map(({ step, title, subtitle }, i) => {
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
                    ? "border-green-400 bg-green-400/15 text-green-400"
                    : done
                      ? "border-green-500/40 bg-green-500/10 text-green-400"
                      : unlocked
                        ? "border-white/20 text-neutral-300"
                        : "border-white/10 text-neutral-600"
                }`}
              >
                {step}
              </span>
              <span className="text-center">
                <span className={`block text-sm font-semibold ${active || done ? "text-white" : "text-neutral-500"}`}>
                  {title}
                </span>
                <span className="block text-xs text-neutral-500">{subtitle}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="mx-3 mt-[-20px] h-px flex-1 bg-white/10">
                <div
                  className="h-px bg-green-500 transition-all"
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
