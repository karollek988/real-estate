"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("landing.analyze.card");
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white/60">
        <InfoIcon className="h-5 w-5" />
      </span>
      <p className="max-w-sm text-[15px] leading-relaxed text-white/80">
        {t("manualNotice")}
      </p>
    </div>
  );
}

/** The tabs. Their names are in the "landing" messages: analyze.card.methods.<key>.label / .short */
const METHODS = [
  { key: "screenshot", icon: UploadCloudIcon },
  { key: "manual", icon: PencilIcon },
  { key: "area", icon: MapPinIcon },
] as const;

// What the Trygghetspaket covers, in the pitch deck's words. The Boendekalkyl
// is marked until it ships (lib/packages.ts HOUSING_COST_LIVE).
const FEATURE_PILLS = [
  { icon: WalletIcon, id: "housingCost", soon: !HOUSING_COST_LIVE },
  { icon: MapPinIcon, id: "area", soon: false },
  { icon: BuildingIcon, id: "brf", soon: false },
  { icon: ShieldIcon, id: "risks", soon: false },
] as const;

const VALUE_PROPS = [
  { icon: ShieldIcon, id: "independent" },
  { icon: BuildingIcon, id: "association" },
  { icon: MapPinIcon, id: "area" },
  { icon: ClipboardIcon, id: "questions" },
] as const;

/**
 * The analysis card: screenshot / manual / area tabs on a deep green panel
 * (the forms are styled for a dark background). Listens for
 * FOCUS_URL_INPUT_EVENT — fired by the onboarding modal, the header's "Skapa
 * analys" on the landing page and the hero — and opens the requested tab
 * (screenshot unless the event says otherwise). One per page: it owns the
 * #analyze anchor.
 */
export function AnalyzeCard({ initialMethod = "screenshot" }: { initialMethod?: AnalysisMethod }) {
  const t = useTranslations("landing.analyze.card");
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
      className="scroll-mt-28 rounded-[24px] bg-ka-green-950 p-5 text-white shadow-ka-panel ring-1 ring-ka-ink/5 sm:p-7 lg:p-8"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[20px] font-semibold tracking-tight">{t("title")}</h3>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_ONBOARDING_MODAL_EVENT))}
          className="cursor-pointer rounded text-[13.5px] font-medium text-ka-mint underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-mint"
        >
          {t("howItWorks")}
        </button>
      </div>
      <p className="mt-1 text-[13px] text-white/60">{t("duration")}</p>

      <div role="tablist" aria-label={t("methodsLabel")} className="mt-5 flex border-b border-white/10">
        {METHODS.map(({ key, icon: Icon }, i) => {
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
                disabled ? "text-white/30" : active ? "text-white" : "text-white/60 hover:text-white"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${active && !disabled ? "text-ka-mint" : ""}`} />
              <span className="sm:hidden">{t(`methods.${key}.short`)}</span>
              <span className="hidden sm:inline">{t(`methods.${key}.label`)}</span>
              {disabled && (
                <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/45">
                  <LockIcon className="h-3 w-3" />
                  {t("soonBadge")}
                </span>
              )}
              {active && !disabled && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-ka-mint-bright" />}
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
  const t = useTranslations("landing.analyze");
  return (
    <section id={sectionId} aria-labelledby="analyze-title" className="relative scroll-mt-24 bg-ka-cream">
      <div className={`${LANDING_CONTAINER} grid gap-12 pb-20 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-16 lg:pb-28 lg:pt-16`}>
        <div className="lg:sticky lg:top-28">
          <p className="w-fit rounded-full bg-ka-sage/80 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-green-900">
            {t("eyebrow")}
          </p>
          <Title
            id="analyze-title"
            className="mt-5 font-display text-[36px] font-bold leading-[1.06] tracking-[-0.015em] text-ka-ink sm:text-[46px]"
          >
            {t.rich("title", { accent: (chunks) => <span className="text-ka-green-700">{chunks}</span> })}
          </Title>
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.6] text-ka-muted">
            {t("lead")}
          </p>

          <ul className="mt-6 flex flex-wrap gap-2.5">
            {FEATURE_PILLS.map(({ icon: Icon, id, soon }) => (
              <li
                key={id}
                className="flex items-center gap-2 rounded-full border border-ka-line bg-white px-4 py-2 text-[14px] font-medium text-ka-ink"
              >
                <Icon className="h-4 w-4 text-ka-green-700" />
                {t(`pills.${id}`)}
                {soon && (
                  <span className="rounded-full bg-ka-sand px-2 py-0.5 text-[11px] font-semibold text-ka-muted">{t("soon")}</span>
                )}
              </li>
            ))}
          </ul>

          <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {VALUE_PROPS.map(({ icon: Icon, id }) => (
              <li key={id} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ka-green-800 text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[16px] font-bold text-ka-ink">{t(`valueProps.${id}.title`)}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-ka-muted">{t(`valueProps.${id}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>

          <aside className="mt-10 flex items-center gap-5 rounded-2xl border border-ka-line bg-white p-5 shadow-[0_18px_40px_-30px_rgba(15,31,24,0.45)] sm:p-6">
            <ShieldIcon className="h-10 w-10 shrink-0 text-ka-green-700" />
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold leading-snug text-ka-ink">
                {t("trust.title")}
              </h3>
            </div>
          </aside>
        </div>

        <AnalyzeCard initialMethod={initialMethod} />
      </div>
    </section>
  );
}
