"use client";

import { useEffect, useRef, useState } from "react";
import { ScreenshotUploadForm } from "@/components/ScreenshotUploadForm";
import { ManualEntryForm } from "@/components/ManualEntryForm";
import { AreaAnalysisForm } from "@/components/AreaAnalysisForm";
import type { AnalysisMethod } from "@/components/landing/ScrollLink";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { FOCUS_URL_INPUT_EVENT, OPEN_ONBOARDING_MODAL_EVENT } from "@/lib/onboardingModalEvents";
import { HOUSING_COST_LIVE } from "@/lib/packages";
import {
  BuildingIcon,
  ClipboardIcon,
  InfoIcon,
  LockIcon,
  MapPinIcon,
  PencilIcon,
  ShieldIcon,
  StarFilledIcon,
  UploadCloudIcon,
  WalletIcon,
} from "@/components/icons";

/**
 * Manual entry now has real required-field validation (address, price,
 * living area, and fee for apartments — see ManualEntryForm.tsx and
 * api/analyses/route.ts), so it's a real fallback next to screenshot
 * upload rather than the previously disabled placeholder. Kept as a flag
 * (rather than deleted) so it can be switched off again in one place if
 * needed without touching ManualEntryForm itself.
 */
const MANUAL_ENTRY_ENABLED = true;

function ManualEntryNotice() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-neutral-400">
        <InfoIcon className="h-5 w-5" />
      </span>
      <p className="max-w-sm text-[15px] leading-relaxed text-neutral-300">
        Manuell inmatning är under utveckling och vi jobbar kontinuerligt med att förbättra den. Just nu kan
        du analysera en bostad genom att ladda upp skärmdumpar av annonsen istället.
      </p>
    </div>
  );
}

const METHODS = [
  { key: "screenshot", label: "Ladda upp skärmdump", short: "Skärmdump", icon: UploadCloudIcon },
  { key: "manual", label: "Manuell inmatning", short: "Manuellt", icon: PencilIcon },
  { key: "area", label: "Områdesanalys", short: "Område", icon: MapPinIcon },
] as const;

// What the Trygghetspaket covers, in the pitch deck's words. The Boendekalkyl
// is marked until it ships (lib/packages.ts HOUSING_COST_LIVE).
const FEATURE_PILLS = [
  { icon: WalletIcon, label: "Boendekalkyl", soon: !HOUSING_COST_LIVE },
  { icon: MapPinIcon, label: "Områdesanalys", soon: false },
  { icon: BuildingIcon, label: "BRF-analys", soon: false },
  { icon: ShieldIcon, label: "Möjliga risker", soon: false },
];

const VALUE_PROPS = [
  {
    icon: ShieldIcon,
    title: "Oberoende granskning",
    description: "Vi står på köparens sida – inte säljarens eller mäklarens.",
  },
  {
    icon: BuildingIcon,
    title: "Föreningen i klartext",
    description: "Granskad av våra experter, klar inom 24 timmar.",
  },
  {
    icon: MapPinIcon,
    title: "Området direkt",
    description: "Service, skolor och resor – automatiskt och på några minuter.",
  },
  {
    icon: ClipboardIcon,
    title: "Frågor inför visningen",
    description: "Det som inte står i annonsen, samlat på ett ställe.",
  },
];

/**
 * The analysis card: screenshot / manual / area tabs on a deep green panel
 * (the forms are styled for a dark background). Listens for
 * FOCUS_URL_INPUT_EVENT — fired by the onboarding modal, the header's "Skapa
 * analys" on the landing page and the hero — and opens the requested tab
 * (screenshot unless the event says otherwise). One per page: it owns the
 * #analyze anchor.
 */
export function AnalyzeCard({ initialMethod = "screenshot" }: { initialMethod?: AnalysisMethod }) {
  const [method, setMethod] = useState<AnalysisMethod>(initialMethod);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    function onFocusUrlInput(e: Event) {
      const requested = (e as CustomEvent<{ method?: AnalysisMethod } | null>).detail?.method;
      setMethod(requested ?? "screenshot");
      requestAnimationFrame(() => {
        document.getElementById("analyze")?.scrollIntoView({ behavior: "smooth" });
      });
    }
    window.addEventListener(FOCUS_URL_INPUT_EVENT, onFocusUrlInput);
    return () => window.removeEventListener(FOCUS_URL_INPUT_EVENT, onFocusUrlInput);
  }, []);

  // Arrow keys move between the tabs (WAI-ARIA tabs pattern).
  function onTabKeyDown(e: React.KeyboardEvent, index: number) {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + METHODS.length) % METHODS.length;
    setMethod(METHODS[next].key);
    tabRefs.current[next]?.focus();
  }

  return (
    <div
      id="analyze"
      className="scroll-mt-28 rounded-[24px] bg-ka-green-950 p-5 text-white shadow-[0_40px_80px_-40px_rgba(12,42,31,0.85)] ring-1 ring-black/5 sm:p-7 lg:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[20px] font-semibold tracking-tight">Analysera en bostad</h3>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_ONBOARDING_MODAL_EVENT))}
          className="cursor-pointer rounded text-[13.5px] font-medium text-ka-mint underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-mint"
        >
          Hur går det till?
        </button>
      </div>
      <p className="mt-1 text-[13px] text-white/60">Tar vanligtvis mindre än 60 sekunder</p>

      <div role="tablist" aria-label="Hur vill du ange bostaden?" className="mt-5 flex border-b border-white/10">
        {METHODS.map(({ key, label, short, icon: Icon }, i) => {
          const active = method === key;
          const disabled = key === "manual" && !MANUAL_ENTRY_ENABLED;
          return (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`analyze-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="analyze-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => setMethod(key)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={`relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-t-md pb-3.5 pt-1 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-mint sm:text-[15px] ${
                disabled ? "text-neutral-600" : active ? "text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${active && !disabled ? "text-green-400" : ""}`} />
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
              {disabled && (
                <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                  <LockIcon className="h-3 w-3" />
                  Snart
                </span>
              )}
              {active && !disabled && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-green-500" />}
            </button>
          );
        })}
      </div>

      <div id="analyze-panel" role="tabpanel" aria-labelledby={`analyze-tab-${method}`} className="mt-6">
        {method === "screenshot" ? (
          <ScreenshotUploadForm />
        ) : method === "area" ? (
          <AreaAnalysisForm />
        ) : MANUAL_ENTRY_ENABLED ? (
          <ManualEntryForm />
        ) : (
          <ManualEntryNotice />
        )}
      </div>
    </div>
  );
}

/**
 * Where an analysis starts: what the analysis covers next to the analysis
 * card. The landing page's "Bostadsanalys" section and the body of /skapa-analys.
 */
export function AnalyzeSection({
  initialMethod = "screenshot",
  titleAs: Title = "h2",
  sectionId = "bostadsanalys",
}: {
  initialMethod?: AnalysisMethod;
  /** "h1" when the section opens its page (/skapa-analys). */
  titleAs?: "h1" | "h2";
  sectionId?: string;
} = {}) {
  return (
    <section id={sectionId} aria-labelledby="analyze-title" className="relative scroll-mt-24 bg-ka-cream">
      <div className={`${LANDING_CONTAINER} grid gap-12 pb-20 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-16 lg:pb-28 lg:pt-16`}>
        <div className="lg:sticky lg:top-28">
          <p className="w-fit rounded-full bg-ka-sage/80 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
            Bostadsanalys
          </p>
          <Title
            id="analyze-title"
            className="mt-5 font-display text-[36px] font-bold leading-[1.06] tracking-[-0.015em] text-ka-ink sm:text-[46px]"
          >
            Köpa bostad? Vi visar vad du <span className="text-ka-green-700">faktiskt köper</span>.
          </Title>
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.6] text-ka-muted">
            En oberoende granskning av bostaden du vill köpa; föreningens ekonomi, området och alla kostnader.
          </p>

          <ul className="mt-6 flex flex-wrap gap-2.5">
            {FEATURE_PILLS.map(({ icon: Icon, label, soon }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-full border border-ka-line bg-white px-4 py-2 text-[14px] font-medium text-ka-ink"
              >
                <Icon className="h-4 w-4 text-ka-green-700" />
                {label}
                {soon && (
                  <span className="rounded-full bg-ka-sand px-2 py-0.5 text-[11px] font-semibold text-ka-muted">snart</span>
                )}
              </li>
            ))}
          </ul>

          <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {VALUE_PROPS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[16px] font-bold text-ka-ink">{title}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-ka-muted">{description}</p>
                </div>
              </li>
            ))}
          </ul>

          <aside className="mt-10 flex items-center gap-5 rounded-2xl border border-ka-line bg-white p-5 shadow-[0_18px_40px_-30px_rgba(15,31,24,0.45)] sm:p-6">
            <ShieldIcon className="h-10 w-10 shrink-0 text-ka-green-700" />
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-snug text-ka-ink">
                Betrodd av fastighetsinvesterare över hela Sverige
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <StarFilledIcon key={i} className="h-[18px] w-[18px] text-ka-green-600" />
                  ))}
                </div>
                <p className="text-[13.5px] text-ka-muted">4.8/5 baserat på 256 omdömen</p>
              </div>
            </div>
          </aside>
        </div>

        <AnalyzeCard initialMethod={initialMethod} />
      </div>
    </section>
  );
}
