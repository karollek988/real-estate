export interface ThreeStepGuideStep {
  title: string;
  description: string;
}

/** Short numbered explainer placed above a tab's real tool (the room
 *  checklist, the document checklist, ...) — answers "what am I supposed to
 *  do here" in three steps before the user dives into the detailed form. */
export function ThreeStepGuide({ steps }: { steps: [ThreeStepGuideStep, ThreeStepGuideStep, ThreeStepGuideStep] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {steps.map((step, i) => (
        <div key={step.title} className="rounded-xl border border-white/10 bg-black/20 p-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-green-400/40 bg-green-400/10 text-sm font-semibold text-green-400">
            {i + 1}
          </span>
          <p className="mt-2.5 text-sm font-semibold text-white">{step.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">{step.description}</p>
        </div>
      ))}
    </div>
  );
}
