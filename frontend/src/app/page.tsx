"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { SiteHeader } from "@/components/SiteHeader";
import { FOCUS_URL_INPUT_EVENT, OPEN_ONBOARDING_MODAL_EVENT } from "@/lib/onboardingModalEvents";
import { ScreenshotUploadForm } from "@/components/ScreenshotUploadForm";
import { ManualEntryForm } from "@/components/ManualEntryForm";
import { NewsSection } from "@/components/sections/NewsSection";
import { ExampleReportSection } from "@/components/sections/ExampleReportSection";
import { InsightsSection } from "@/components/sections/InsightsSection";
import { InfoSection } from "@/components/sections/InfoSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { ContactSection } from "@/components/sections/ContactSection";
import { SectionDivider } from "@/components/SectionDivider";
import type { MarketStats } from "@/lib/marketStats";
import {
  BrainIcon,
  BuildingIcon,
  ChartIcon,
  DatabaseIcon,
  HouseIcon,
  InfoIcon,
  LockIcon,
  MapPinIcon,
  PencilIcon,
  PlayCircleIcon,
  ShieldIcon,
  StarFilledIcon,
  StarIcon,
  TrendingUpIcon,
  UploadCloudIcon,
  ZapIcon,
} from "@/components/icons";

type Method = "screenshot" | "manual";

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

const FEATURE_PILLS = [
  { icon: ChartIcon, label: "Prisanalys" },
  { icon: MapPinIcon, label: "Områdesanalys" },
  { icon: BuildingIcon, label: "BRF-analys" },
  { icon: ShieldIcon, label: "Möjliga risker" },
  { icon: TrendingUpIcon, label: "Investeringsprognos" },
];

const VALUE_PROPS = [
  {
    icon: DatabaseIcon,
    title: "20+ Datakällor",
    description: "Offentliga register, transaktioner och mycket mer",
  },
  {
    icon: BrainIcon,
    title: "AI-driven Analys",
    description: "Avancerade algoritmer för marknadsanalys",
  },
  {
    icon: ShieldIcon,
    title: "Objektiv & Oberoende",
    description: "Ingen favoritism. Ren data och fakta i fokus.",
  },
  {
    icon: ZapIcon,
    title: "Snabbt & Enkelt",
    description: "Få komplett analys på bara några sekunder",
  },
];

const CHART_GRID = [
  { label: "+10%", y: 12 },
  { label: "+5%", y: 37 },
  { label: "0%", y: 62 },
  { label: "-5%", y: 87 },
  { label: "-10%", y: 112 },
];

function MarketChart({ labels, values }: { labels: string[]; values: number[] }) {
  const points = values.map((v, i) => ({
    x: 34 + (i * (432 - 34)) / Math.max(1, values.length - 1),
    y: 62 - v * 5,
  }));

  return (
    <svg viewBox="0 0 440 132" className="mt-3 w-full" aria-hidden="true">
      {CHART_GRID.map(({ label, y }) => (
        <g key={label}>
          <line x1={34} x2={432} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 4" />
          <text x={28} y={y + 3} textAnchor="end" fontSize="8.5" fill="#7c847f">
            {label}
          </text>
        </g>
      ))}
      <polyline
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p) => (
        <circle key={p.x} cx={p.x} cy={p.y} r="2.2" fill="#4ade80" />
      ))}
      {labels.map((label, i) => (
        <text key={i} x={points[i].x} y={128} textAnchor="middle" fontSize="8.5" fill="#7c847f">
          {label}
        </text>
      ))}
    </svg>
  );
}

export default function Home() {
  const [method, setMethod] = useState<Method>("screenshot");
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market-stats")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: MarketStats) => {
        if (!cancelled) setMarketStats(data);
      })
      .catch(() => {
        // Leave marketStats null — the hero panel falls back to its own placeholders below.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onFocusUrlInput() {
      const desktopCard = document.getElementById("analyze");
      const isDesktop = desktopCard && desktopCard.offsetParent !== null;

      setMethod("screenshot");
      requestAnimationFrame(() => {
        const target = isDesktop ? desktopCard : document.getElementById("analyze-mobile");
        target?.scrollIntoView({ behavior: "smooth" });
      });
    }
    window.addEventListener(FOCUS_URL_INPUT_EVENT, onFocusUrlInput);
    return () => window.removeEventListener(FOCUS_URL_INPUT_EVENT, onFocusUrlInput);
  }, []);

  const hox = marketStats?.housePriceIndex ?? null;
  const sqmNational = marketStats?.pricePerSqm?.areas.find((a) => a.name === "Riksgenomsnitt") ?? null;

  // Last ~4 quarters (12 months) of the national house price index, expressed as
  // cumulative % change from the first point so the chart starts at 0% — same
  // shape as before, now driven by SCB's real quarterly index instead of a
  // hardcoded monthly curve (SCB doesn't publish this index monthly).
  const heroQuarters = hox ? hox.quarterLabels.slice(-5) : [];
  const heroIndexValues = hox ? hox.values.slice(-5) : [];
  const heroBase = heroIndexValues[0];
  const heroChartValues =
    heroBase && heroIndexValues.length > 1
      ? heroIndexValues.map((v) => Math.round(((v - heroBase) / heroBase) * 1000) / 10)
      : [];

  const priceChangeLabel =
    hox?.yoyChangePct != null
      ? `${hox.yoyChangePct > 0 ? "+" : ""}${hox.yoyChangePct.toFixed(1).replace(".", ",")}%`
      : "—";
  const demandLabel =
    hox?.yoyChangePct == null ? "—" : hox.yoyChangePct > 0.5 ? "Hög" : hox.yoyChangePct < -0.5 ? "Låg" : "Stabil";

  const marketStatsDisplay = [
    {
      icon: HouseIcon,
      label: "Medelpris",
      value: sqmNational ? sqmNational.pricePerM2.toLocaleString("sv-SE") : "—",
      unit: sqmNational ? "kr/kvm" : undefined,
    },
    { icon: ChartIcon, label: "Prisutveckling", value: priceChangeLabel },
    { icon: StarIcon, label: "Efterfrågan", value: demandLabel },
  ];

  return (
    <div className="min-h-screen bg-[#111927] text-white">
      {/* Navigation */}
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0A0F0D]">
        <Image
          src="/hero-background.png"
          alt="Flygfoto över ett svenskt bostadsområde med prisindikatorer"
          fill
          priority
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_42%,rgba(10,15,13,0.72)_72%,rgba(13,18,26,0.98)_100%)]" />
        <div className="absolute bottom-0 right-0 h-[560px] w-[860px] bg-[radial-gradient(ellipse_at_bottom_right,rgba(13,18,26,0.97)_0%,rgba(13,18,26,0.82)_40%,rgba(13,18,26,0.4)_65%,transparent_85%)]" />

        {/* Mobile hero */}
        <div className="relative flex min-h-[calc(100svh-68px)] flex-col px-5 pb-14 pt-16 lg:hidden">
          <div className="animate-fade-in-up text-center">
            <h1 className="text-[36px] font-bold leading-[1.18] tracking-tight">
              Analysera vilken
              <br />
              <span className="text-green-400">bostad</span> som helst.
            </h1>
            <p className="mx-auto mt-5 max-w-[320px] text-[17px] leading-[1.6] text-neutral-300">
              Ladda upp en skärmdump av bostadsannonsen så analyserar vi
              marknadspotentialen åt dig — klart på under 3 minuter.
            </p>
          </div>

          {/* Mobile input card */}
          <div
            id="analyze-mobile"
            className="animate-fade-in-up delay-2 mt-9 scroll-mt-24 rounded-[24px] border border-white/10 bg-[#0F1417]/90 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <div className="flex border-b border-white/10">
              {(
                [
                  { key: "screenshot", label: "Skärmdump", icon: UploadCloudIcon },
                  { key: "manual", label: "Manuellt", icon: PencilIcon },
                ] as const
              ).map(({ key, label, icon: Icon }) => {
                const active = method === key;
                const disabled = key === "manual" && !MANUAL_ENTRY_ENABLED;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMethod(key)}
                    className={`relative flex flex-1 items-center justify-center gap-2 pb-3.5 pt-1 text-[15px] font-semibold transition ${
                      disabled
                        ? "text-neutral-600"
                        : active
                          ? "text-white"
                          : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] ${active && !disabled ? "text-green-400" : ""}`} />
                    {label}
                    {disabled && (
                      <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                        <LockIcon className="h-3 w-3" />
                        Snart
                      </span>
                    )}
                    {active && !disabled && (
                      <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-green-500" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              {method === "screenshot" ? (
                <ScreenshotUploadForm />
              ) : MANUAL_ENTRY_ENABLED ? (
                <ManualEntryForm />
              ) : (
                <ManualEntryNotice />
              )}
            </div>
          </div>
        </div>

        <div className="relative mx-auto hidden w-full max-w-[1400px] px-6 pt-[46px] lg:block">
          {/* Feature pills */}
          <div className="flex flex-wrap justify-end gap-4">
            {FEATURE_PILLS.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/50 px-5 py-3 text-sm font-medium text-white backdrop-blur-md"
              >
                <Icon className="h-4 w-4 text-green-400" />
                {label}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
            {/* Headline block */}
            <div className="max-w-[600px] lg:-mt-[52px]">
              <h1 className="text-[40px] font-bold leading-[1.15] tracking-tight sm:text-[48px]">
                Analysera vilken
                <br />
                <span className="text-green-400">bostad</span> som helst.
              </h1>

              <p className="mt-4 max-w-[310px] text-[17px] leading-[1.6] text-neutral-300">
                Ladda upp en skärmdump av bostadsannonsen så analyserar vi
                marknadspotentialen åt dig — klart på under 3 minuter.
              </p>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_ONBOARDING_MODAL_EVENT))}
                className="mt-8 inline-flex items-center gap-2.5 rounded-[10px] bg-green-600 px-6 py-3 text-[15px] font-semibold text-white transition hover:scale-[1.02] hover:bg-green-500 active:scale-[0.99]"
              >
                Se hur det fungerar
                <PlayCircleIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Market overview panel */}
            <aside className="w-full shrink-0 rounded-2xl border border-white/10 bg-[#0C110F]/85 p-5 backdrop-blur-md lg:w-[450px]">
              <h2 className="text-[17px] font-semibold">Marknadsöversikt</h2>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-neutral-400">
                  Prisutveckling senaste 12 månaderna
                </span>
                <span className="flex items-center gap-1 text-sm font-semibold text-green-400">
                  {priceChangeLabel}
                  <TrendingUpIcon className="h-3.5 w-3.5" />
                </span>
              </div>

              {heroChartValues.length > 0 ? (
                <MarketChart labels={heroQuarters} values={heroChartValues} />
              ) : (
                <div className="mt-3 h-[132px] w-full animate-pulse rounded-lg bg-white/[0.03]" />
              )}

              <div className="mt-4 grid grid-cols-3 gap-3">
                {marketStatsDisplay.map(({ icon: Icon, label, value, unit }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <Icon className="h-5 w-5 text-neutral-100" />
                    <p className="mt-3 text-xs text-neutral-400">{label}</p>
                    <p className="mt-1 whitespace-nowrap text-base font-semibold text-green-400">
                      {value}
                      {unit && <span className="ml-1 text-[11px] font-medium">{unit}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          {/* Floating input card */}
          <div
            id="analyze"
            className="relative z-10 mx-auto w-full max-w-[616px] scroll-mt-24 rounded-[20px] border border-white/10 bg-[#0F1417]/95 p-7 backdrop-blur-xl lg:-mt-[140px] lg:mx-0 lg:ml-[268px]"
          >
            <div className="flex border-b border-white/10">
              {(
                [
                  { key: "screenshot", label: "Ladda upp skärmdump", icon: UploadCloudIcon },
                  { key: "manual", label: "Manuell inmatning", icon: PencilIcon },
                ] as const
              ).map(({ key, label, icon: Icon }) => {
                const active = method === key;
                const disabled = key === "manual" && !MANUAL_ENTRY_ENABLED;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMethod(key)}
                    className={`relative flex flex-1 items-center justify-center gap-2 pb-3.5 text-[15px] font-semibold transition ${
                      disabled
                        ? "text-neutral-600"
                        : active
                          ? "text-white"
                          : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] ${active && !disabled ? "text-green-400" : ""}`} />
                    {label}
                    {disabled && (
                      <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                        <LockIcon className="h-3 w-3" />
                        Snart
                      </span>
                    )}
                    {active && !disabled && (
                      <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-green-500" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              {method === "screenshot" ? (
                <ScreenshotUploadForm />
              ) : MANUAL_ENTRY_ENABLED ? (
                <ManualEntryForm />
              ) : (
                <ManualEntryNotice />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Below the fold */}
      <section className="bg-[#111927]">
        <div className="mx-auto w-full max-w-[1400px] px-5 pb-14 pt-10 lg:px-6 lg:pb-7 lg:pt-9">
          {/* Mobile features + trust card */}
          <div id="features" className="lg:hidden">
            <div className="grid grid-cols-4 divide-x divide-white/10">
              {VALUE_PROPS.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex flex-col items-center px-2 text-center">
                  <Icon className="h-6 w-6 text-green-400" />
                  <h3 className="mt-3 text-[13px] font-semibold leading-snug">{title}</h3>
                  <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
                    {description}
                  </p>
                </div>
              ))}
            </div>

            <aside className="mt-12 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <div className="flex items-start gap-4">
                <ShieldIcon className="h-11 w-11 shrink-0 text-green-400" />
                <div className="min-w-0">
                  <h3 className="text-[19px] font-semibold leading-snug">
                    Betrodd av fastighetsinvesterare över hela Sverige
                  </h3>
                  <div className="mt-4 flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <StarFilledIcon key={i} className="h-6 w-6 text-green-500" />
                    ))}
                  </div>
                  <p className="mt-3 text-[15px] text-neutral-400">
                    4.8/5 baserat på 256 omdömen
                  </p>
                </div>
              </div>
            </aside>
          </div>

          <div className="hidden lg:flex lg:flex-row lg:items-start lg:gap-12">
            <div className="grid flex-1 grid-cols-2 gap-y-10 lg:grid-cols-4 lg:divide-x lg:divide-white/10">
              {VALUE_PROPS.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex flex-col items-center px-6 text-center">
                  <Icon className="h-7 w-7 text-green-400" />
                  <h3 className="mt-4 text-[15px] font-semibold">{title}</h3>
                  <p className="mt-2 max-w-[190px] text-[13px] leading-relaxed text-neutral-400">
                    {description}
                  </p>
                </div>
              ))}
            </div>

            <aside className="w-full shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-6 lg:w-[368px]">
              <div className="flex items-start gap-3">
                <ShieldIcon className="h-7 w-7 shrink-0 text-green-400" />
                <h3 className="text-base font-semibold leading-snug">
                  Betrodd av fastighetsinvesterare över hela Sverige
                </h3>
              </div>
              <div className="mt-4 flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarFilledIcon key={i} className="h-5 w-5 text-green-500" />
                ))}
              </div>
              <p className="mt-2.5 text-[13px] text-neutral-400">
                4.8/5 baserat på 256 omdömen
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* Content sections */}
      <SectionDivider />
      <NewsSection />
      <SectionDivider />
      <ExampleReportSection />
      <SectionDivider />
      <InsightsSection />
      <SectionDivider />
      <InfoSection />
      <SectionDivider />
      <FaqSection />
      <SectionDivider />
      <ContactSection />
    </div>
  );
}
