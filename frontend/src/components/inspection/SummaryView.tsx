import { CheckIcon, WarningIcon, TrendingUpIcon, ClipboardIcon, QuestionIcon, ShieldIcon } from "@/components/icons";
import type { InspectionSummary } from "@/lib/inspection/types";

function SummarySection({
  icon,
  title,
  items,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone?: "positive" | "negative" | "neutral";
}) {
  if (items.length === 0) return null;
  const dot =
    tone === "positive" ? "bg-green-400" : tone === "negative" ? "bg-red-400" : "bg-neutral-400";
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        {icon}
        {title}
      </h3>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-300">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SummaryView({ summary }: { summary: InspectionSummary }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-green-500/30 bg-green-500/[0.05] p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-green-300">
          <ShieldIcon className="h-4 w-4" />
          Övergripande rekommendation
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-200">{summary.overallRecommendation}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SummarySection
          icon={<CheckIcon className="h-4 w-4 text-green-400" />}
          title="Styrkor"
          items={summary.strengths}
          tone="positive"
        />
        <SummarySection
          icon={<WarningIcon className="h-4 w-4 text-amber-400" />}
          title="Svagheter"
          items={summary.weaknesses}
          tone="negative"
        />
        <SummarySection
          icon={<TrendingUpIcon className="h-4 w-4 text-amber-400" />}
          title="Möjliga framtida kostnader"
          items={summary.futureCosts}
        />
        <SummarySection
          icon={<ClipboardIcon className="h-4 w-4 text-neutral-300" />}
          title="Rekommenderad uppföljning"
          items={summary.followUp}
        />
        <SummarySection
          icon={<WarningIcon className="h-4 w-4 text-amber-400" />}
          title="Saknad dokumentation"
          items={summary.missingDocumentation}
        />
        <SummarySection
          icon={<QuestionIcon className="h-4 w-4 text-neutral-300" />}
          title="Öppna frågor"
          items={summary.openQuestions}
        />
      </div>

      {summary.strengths.length === 0 &&
        summary.weaknesses.length === 0 && (
          <p className="text-sm text-neutral-400">
            Gå igenom checklistan under &quot;Under besiktning&quot; för att generera en fullständig sammanfattning.
          </p>
        )}
    </div>
  );
}
