import type { BrfChapterState } from "@/lib/report/brfChapter";
import { daySv, dueSv } from "@/lib/report/brfChapter";
import { BRF_BENCHMARK_SOURCES, type BrfImpact, type BrfSignal, type Tone } from "@/lib/brf/interpret";
import { BadgeCheckIcon, CheckIcon, ClipboardIcon, InfoIcon, ShieldIcon, WalletIcon, WarningIcon } from "@/components/icons";

/**
 * The body of the report's "Bostadsrättsförening" chapter. Used by the report
 * page (server) and by the review console's live preview (/admin/brf), so the
 * reviewer sees exactly what the customer will see.
 */

const TONE_STYLE: Record<Tone, { chip: string; dot: string }> = {
  good: { chip: "bg-[#4B7A57]/[0.1] text-[#3D6A49] border-[#4B7A57]/25", dot: "bg-[#4B7A57]" },
  neutral: { chip: "bg-black/[0.04] text-[#5B5648] border-black/10", dot: "bg-[#8C8471]" },
  watch: { chip: "bg-[#B98A2E]/[0.12] text-[#7A5A16] border-[#B98A2E]/30", dot: "bg-[#B98A2E]" },
  alert: { chip: "bg-[#A2432F]/[0.1] text-[#8A3423] border-[#A2432F]/30", dot: "bg-[#A2432F]" },
};

const ACCENT = "#3B5F7A";

function Heading({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h3
      style={{ fontFamily: "var(--font-report-serif)", borderLeftColor: `${ACCENT}66` }}
      className="relative mb-3 mt-9 flex items-center gap-2 border-l-[3px] py-0.5 pl-3 text-[17.5px] font-semibold text-[#12271D]"
    >
      {icon && <span className="flex h-6 w-6 shrink-0 items-center justify-center" style={{ color: ACCENT }}>{icon}</span>}
      {children}
    </h3>
  );
}

function SignalCard({ signal }: { signal: BrfSignal }) {
  const tone = TONE_STYLE[signal.tone];
  return (
    <div className="rounded-md border border-black/[0.08] bg-white/70 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[12px] font-medium uppercase tracking-wide text-[#8C8471]">{signal.label}</p>
        <p className="text-[18px] font-semibold leading-tight text-[#12271D]">{signal.value}</p>
      </div>
      <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${tone.chip}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
        {signal.verdict}
      </span>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#3A362C]">{signal.meaning}</p>
      {signal.benchmark && <p className="mt-1.5 text-[12px] leading-relaxed text-[#8C8471]">{signal.benchmark}</p>}
    </div>
  );
}

function ImpactCard({ impact }: { impact: BrfImpact }) {
  const tone = TONE_STYLE[impact.tone];
  return (
    <div className="rounded-md border border-black/[0.08] bg-white/70 p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} />
        <p className="text-[12px] font-medium uppercase tracking-wide text-[#8C8471]">{impact.label}</p>
      </div>
      <p className="mt-1.5 text-[19px] font-semibold leading-tight text-[#12271D]">{impact.value}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#3A362C]">{impact.explanation}</p>
    </div>
  );
}

function SignalGrid({ signals }: { signals: BrfSignal[] }) {
  return (
    <div className="relative grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {signals.map((s) => (
        <SignalCard key={s.id} signal={s} />
      ))}
    </div>
  );
}

const WHAT_IS_INCLUDED = [
  "Föreningens skuldsättning, sparande och räntekänslighet — förklarade i klartext och jämförda med vad som brukar räknas som lågt och högt.",
  "Vad föreningens ekonomi betyder för dig i kronor: din del av föreningens lån och hur avgiften påverkas om räntan stiger.",
  "Stambyte, planerat underhåll, tomträtt och beslutade avgiftshöjningar.",
  "Frågor att ställa till föreningen och mäklaren.",
];

export function BrfAnalysis({
  state,
  associationName,
  upload,
}: {
  state: Exclude<BrfChapterState, { kind: "freehold" }>;
  associationName: string | null;
  /** The annual-report upload, rendered where the chapter asks for a document. */
  upload?: React.ReactNode;
}) {
  if (state.kind === "not_applicable") {
    return (
      <p className="relative text-[15.5px] leading-[1.8] text-[#2A2820]">
        Bostaden ingår inte i någon bostadsrättsförening, så det finns ingen föreningsekonomi att granska.
      </p>
    );
  }

  if (state.kind === "awaiting") {
    const due = dueSv(state.dueAt);
    return (
      <div className="relative">
        <div className="rounded-lg border p-5 sm:p-6" style={{ borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}0D` }}>
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
              <ShieldIcon className="h-5 w-5" />
            </span>
            <div>
              <p style={{ fontFamily: "var(--font-report-serif)" }} className="text-[19px] font-semibold leading-snug text-[#12271D]">
                BRF-analysen granskas av våra experter
              </p>
              <p className="mt-1 text-[13.5px] font-medium" style={{ color: ACCENT }}>
                {state.overdue
                  ? "Granskningen tar lite längre tid än utlovat — analysen publiceras här så snart den är klar."
                  : due
                    ? `Klar senast ${due}`
                    : "Klar inom 24 timmar från beställningen"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[14.5px] leading-relaxed text-[#2A2820]">
            Föreningens ekonomi är den del av ett bostadsköp som är svårast att bedöma på egen hand, så den här delen
            läser vi inte bara av automatiskt. En av Köpanalys experter går igenom
            {associationName ? ` ${associationName}s` : " föreningens"} årsredovisning, kontrollerar varje nyckeltal och
            förklarar vad siffrorna betyder för dig — innan analysen visas här. Övriga delar av rapporten är klara och kan
            läsas redan nu.
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-[#3A362C]">
            {state.documentReceived
              ? "Vi har tagit emot föreningens årsredovisning och granskar den nu."
              : "Har du föreningens senaste årsredovisning? Ladda upp den nedan så går granskningen snabbare — annars tar vi fram den själva."}
          </p>
          {upload}
        </div>

        <Heading icon={<ClipboardIcon className="h-4 w-4" />}>Det här får du i BRF-analysen</Heading>
        <ul className="relative space-y-2">
          {WHAT_IS_INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[14px] leading-relaxed text-[#2A2820]">
              <CheckIcon className="mt-1 h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const { reading } = state;
  const day = daySv(state.publishedAt);
  const updateDue = state.update ? dueSv(state.update.dueAt) : null;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4B7A57]/30 bg-[#4B7A57]/[0.08] px-3 py-1 text-[12.5px] font-semibold text-[#3D6A49]">
          <BadgeCheckIcon className="h-3.5 w-3.5" />
          Granskad av Köpanalys{day ? ` · ${day}` : ""}
        </span>
        {reading.fiscalYear && (
          <span className="text-[12.5px] text-[#8C8471]">Underlag: årsredovisningen för {reading.fiscalYear}</span>
        )}
      </div>

      {state.update && (
        <p className="mt-3 rounded-md border border-[#B98A2E]/30 bg-[#B98A2E]/[0.06] px-4 py-2.5 text-[13px] text-[#5B5648]">
          En nyare årsredovisning granskas just nu.{" "}
          {state.update.overdue || !updateDue ? "Analysen uppdateras så snart granskningen är klar." : `Analysen uppdateras senast ${updateDue}.`}
        </p>
      )}

      {(reading.strengths.length > 0 || reading.concerns.length > 0) && (
        <div className="relative mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {reading.strengths.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4B7A57]">Det här ser bra ut</p>
              <ul className="mt-2 space-y-1.5">
                {reading.strengths.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-[#2A2820]">
                    <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4B7A57]" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reading.concerns.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A2432F]">Värt en närmare titt</p>
              <ul className="mt-2 space-y-1.5">
                {reading.concerns.map((c) => (
                  <li key={c} className="flex items-start gap-2 text-[13.5px] leading-relaxed text-[#2A2820]">
                    <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A2432F]" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {reading.forYou.length > 0 && (
        <>
          <Heading icon={<WalletIcon className="h-4 w-4" />}>Vad det betyder för dig</Heading>
          <div className="relative grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {reading.forYou.map((impact) => (
              <ImpactCard key={impact.id} impact={impact} />
            ))}
          </div>
        </>
      )}

      {reading.keyFigures.length > 0 && (
        <>
          <Heading>Nyckeltal</Heading>
          <SignalGrid signals={reading.keyFigures} />
        </>
      )}

      {reading.loans.length > 0 && (
        <>
          <Heading>Föreningens lån</Heading>
          <SignalGrid signals={reading.loans} />
        </>
      )}

      {reading.association.length > 0 && (
        <>
          <Heading>Föreningen och underhållet</Heading>
          <SignalGrid signals={reading.association} />
        </>
      )}

      {reading.missingKeyFigures.length > 0 && (
        <p className="relative mt-5 text-[13px] italic text-[#8C8471]">
          Årsredovisningen anger inte {reading.missingKeyFigures.join(", ")}.
        </p>
      )}

      {reading.expertComment && (
        <div className="relative mt-8 rounded-md border-l-[3px] bg-white/70 px-5 py-4" style={{ borderLeftColor: ACCENT }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
            Kommentar från granskaren
          </p>
          <p className="mt-1.5 whitespace-pre-line text-[14.5px] leading-relaxed text-[#2A2820]">{reading.expertComment}</p>
        </div>
      )}

      <p className="relative mt-6 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-[#8C8471]">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Nyckeltalen är hämtade ur föreningens årsredovisning och kontrollerade av en granskare på Köpanalys. Bedömningarna
          jämför varje nyckeltal med vad som brukar räknas som lågt och högt; de är inget betyg på föreningen.{" "}
          {BRF_BENCHMARK_SOURCES}
        </span>
      </p>

      {upload}
    </div>
  );
}
