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
        <div key={step.title} className="rounded-xl border border-ka-line-strong bg-ka-cream p-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ka-green-700/40 bg-ka-sage/60 text-sm font-semibold text-ka-green-700">
            {i + 1}
          </span>
          <p className="mt-2.5 text-sm font-semibold text-ka-ink">{step.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-ka-muted">{step.description}</p>
        </div>
      ))}
    </div>
  );
}
