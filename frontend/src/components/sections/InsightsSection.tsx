"use client";

import { useEffect, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { LANDING_CONTAINER } from "@/components/landing/container";
import {
  BuildingIcon,
  ChartIcon,
  PercentIcon,
  TrendingUpIcon,
} from "@/components/icons";
import type { MarketStats } from "@/lib/marketStats";

const PLOT = { left: 40, right: 428, top: 14, bottom: 112 };

/* Chart colours on the light cards. */
const LINE = "#2a7854";
const LABEL = "#6b726d";
const VALUE = "#1f2622";
const LABEL_Y = 138;

function xAt(i: number, n: number) {
  return PLOT.left + (i * (PLOT.right - PLOT.left)) / Math.max(1, n - 1);
}

function yAt(v: number, min: number, max: number) {
  return PLOT.bottom - ((v - min) / (max - min)) * (PLOT.bottom - PLOT.top);
}

function niceBounds(values: number[], step: number): { min: number; max: number } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const min = Math.floor(lo / step) * step - step;
  const max = Math.ceil(hi / step) * step + step;
  return { min, max };
}

/** Groups consecutive labels by their leading year (e.g. "2024K3" -> "2024"), one marker per year transition. */
function yearMarkers(labels: string[]): { label: string; i: number }[] {
  const markers: { label: string; i: number }[] = [];
  let lastYear: string | null = null;
  labels.forEach((label, i) => {
    const year = label.slice(0, 4);
    if (year !== lastYear) {
      markers.push({ label: year, i });
      lastYear = year;
    }
  });
  return markers;
}

function formatSwedishNumber(n: number, decimals = 1): string {
  return n.toFixed(decimals).replace(".", ",").replace(/^-/, "−");
}

function GridLine({ y, label }: { y: number; label: string }) {
  return (
    <g>
      <line
        x1={PLOT.left}
        x2={PLOT.right}
        y1={y}
        y2={y}
        stroke="rgba(15,31,24,0.09)"
        strokeDasharray="3 4"
      />
      <text x={PLOT.left - 7} y={y + 3} textAnchor="end" fontSize="8.5" fill={LABEL}>
        {label}
      </text>
    </g>
  );
}

function ChartSkeleton() {
  return (
    <div className="mt-4 h-[148px] w-full animate-pulse rounded-lg bg-ka-ink/[0.04]" />
  );
}

function ChartUnavailable() {
  return (
    <div className="mt-4 flex h-[148px] w-full items-center justify-center rounded-lg border border-ka-line text-xs text-ka-muted">
      Data kunde inte hämtas just nu
    </div>
  );
}

/* Styrränta — kvartalsvis, stegkurva */
function InterestRateChart({ values, quarterLabels }: { values: number[]; quarterLabels: string[] }) {
  const { min, max } = niceBounds(values, 0.5);
  const points = values.map((v, i) => ({ x: xAt(i, values.length), y: yAt(v, min, max) }));
  const d = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `H ${p.x} V ${p.y}`))
    .join(" ");
  const last = points[points.length - 1];
  const gridSteps = [max, (max + min) / 2, min];
  const years = yearMarkers(quarterLabels);

  return (
    <svg
      viewBox="0 0 440 148"
      className="mt-4 w-full"
      role="img"
      aria-label={`Styrräntans utveckling, senaste till ${formatSwedishNumber(values[values.length - 1], 2)} procent`}
    >
      {gridSteps.map((v) => (
        <GridLine key={v} y={yAt(v, min, max)} label={`${Math.round(v * 10) / 10}%`} />
      ))}
      <path
        d={d}
        pathLength={1}
        className="chart-line"
        fill="none"
        stroke={LINE}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <g key={p.x}>
          <circle className="chart-fade" cx={p.x} cy={p.y} r="2.2" fill={LINE} />
          <circle cx={p.x} cy={p.y} r="9" fill="transparent">
            <title>{`${quarterLabels[i]}: ${formatSwedishNumber(values[i], 2)} %`}</title>
          </circle>
        </g>
      ))}
      <text
        className="chart-fade"
        x={last.x}
        y={last.y - 9}
        textAnchor="end"
        fontSize="9"
        fontWeight="600"
        fill={VALUE}
      >
        {formatSwedishNumber(values[values.length - 1], 2)}%
      </text>
      {years.map(({ label, i }) => (
        <text key={label} x={xAt(i, values.length)} y={LABEL_Y} textAnchor="middle" fontSize="8.5" fill={LABEL}>
          {label}
        </text>
      ))}
    </svg>
  );
}

/* Bostadsprisindex — kvartalsvis, ytdiagram */
function HousePriceChart({ values, quarterLabels }: { values: number[]; quarterLabels: string[] }) {
  const { min, max } = niceBounds(values, 4);
  const points = values.map((v, i) => ({ x: xAt(i, values.length), y: yAt(v, min, max) }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1].x} ${PLOT.bottom} L ${points[0].x} ${PLOT.bottom} Z`;
  const gridSteps = [max, max - (max - min) / 3, max - (2 * (max - min)) / 3, min];

  return (
    <svg
      viewBox="0 0 440 148"
      className="mt-4 w-full"
      role="img"
      aria-label={`Bostadsprisindex (småhus), senaste noteringen ${values[values.length - 1]}`}
    >
      <defs>
        <linearGradient id="hox-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(42,120,84,0.22)" />
          <stop offset="100%" stopColor="rgba(42,120,84,0)" />
        </linearGradient>
      </defs>
      {gridSteps.map((v) => (
        <GridLine key={v} y={yAt(v, min, max)} label={`${Math.round(v)}`} />
      ))}
      <path className="chart-area" d={area} fill="url(#hox-area)" />
      <path
        d={line}
        pathLength={1}
        className="chart-line"
        fill="none"
        stroke={LINE}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={p.x} cx={p.x} cy={p.y} r="9" fill="transparent">
          <title>{`${quarterLabels[i]}: ${values[i]}`}</title>
        </circle>
      ))}
      <circle
        className="chart-fade"
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2.6"
        fill={LINE}
      />
      <text
        className="chart-fade"
        x={points[points.length - 1].x - 2}
        y={points[points.length - 1].y - 9}
        textAnchor="end"
        fontSize="9"
        fontWeight="600"
        fill={VALUE}
      >
        {values[values.length - 1]}
      </text>
      {quarterLabels.map((label, i) =>
        i % 2 === 0 ? (
          <text key={i} x={points[i].x} y={LABEL_Y} textAnchor="middle" fontSize="8.5" fill={LABEL}>
            {label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/* Kvadratmeterpris — horisontella staplar per stad */
function SqmPriceChart({ areas }: { areas: { name: string; pricePerM2: number }[] }) {
  const max = Math.max(...areas.map((a) => a.pricePerM2)) * 1.07;
  return (
    <div className="mt-5 space-y-4">
      {areas.map(({ name, pricePerM2 }, i) => (
        <div key={name}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-ka-muted">{name}</span>
            <span className="font-semibold text-ka-ink">
              {pricePerM2.toLocaleString("sv-SE")} kr
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ka-ink/[0.06]">
            <div
              className="chart-bar h-full rounded-full bg-gradient-to-r from-ka-green-800 to-ka-green-600"
              style={
                {
                  width: `${(pricePerM2 / max) * 100}%`,
                  "--chart-bar-delay": `${i * 90}ms`,
                } as React.CSSProperties
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Inflation (KPIF) — månadsvis, linje med målnivå */
function InflationChart({ values, monthLabels }: { values: number[]; monthLabels: string[] }) {
  const { min, max } = niceBounds([...values, 2], 1);
  const points = values.map((v, i) => ({ x: xAt(i, values.length), y: yAt(v, min, max) }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const targetY = yAt(2, min, max);
  const gridSteps = [max, min].filter((v) => v !== 2);

  return (
    <svg
      viewBox="0 0 440 148"
      className="mt-4 w-full"
      role="img"
      aria-label={`Inflationen KPIF, senaste ${formatSwedishNumber(values[values.length - 1])} procent`}
    >
      {gridSteps.map((v) => (
        <GridLine key={v} y={yAt(v, min, max)} label={`${Math.round(v)}%`} />
      ))}
      <line
        x1={PLOT.left}
        x2={PLOT.right}
        y1={targetY}
        y2={targetY}
        stroke="rgba(42,120,84,0.5)"
        strokeDasharray="5 4"
      />
      <text x={PLOT.left - 7} y={targetY + 3} textAnchor="end" fontSize="8.5" fill={LABEL}>
        2%
      </text>
      <text x={PLOT.right} y={targetY - 6} textAnchor="end" fontSize="8.5" fill={LABEL}>
        Inflationsmål
      </text>
      <path
        d={line}
        pathLength={1}
        className="chart-line"
        fill="none"
        stroke={LINE}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <g key={p.x}>
          <circle className="chart-fade" cx={p.x} cy={p.y} r="2.2" fill={LINE} />
          <circle cx={p.x} cy={p.y} r="9" fill="transparent">
            <title>{`${monthLabels[i]}: ${formatSwedishNumber(values[i])} %`}</title>
          </circle>
        </g>
      ))}
      {monthLabels.map((month, i) =>
        i % 2 === 0 ? (
          <text key={i} x={points[i].x} y={LABEL_Y} textAnchor="middle" fontSize="8.5" fill={LABEL}>
            {month}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function trendBadge(changePct: number | null): string {
  if (changePct === null) return "Okänd trend";
  if (changePct > 0.5) return "Stigande";
  if (changePct < -0.5) return "Fallande";
  return "Stabil";
}

function inflationBadge(latest: number): string {
  const distance = latest - 2;
  if (Math.abs(distance) <= 0.3) return "Nära målet";
  return distance > 0 ? "Över målet" : "Under målet";
}

function formatRateChangeBadge(changePtPct: number | null): string {
  if (changePtPct === null) return "—";
  if (changePtPct === 0) return "±0 pp";
  const sign = changePtPct > 0 ? "+" : "−";
  return `${sign}${formatSwedishNumber(Math.abs(changePtPct), 2)} pp`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Live market statistics (styrränta, bostadspriser, kvm-pris, inflation) via /api/market-stats - the body of /prisutveckling. */
export function InsightsSection({ intro = true }: { intro?: boolean } = {}) {
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/market-stats")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad response"))))
      .then((data: MarketStats) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = stats === null && !loadFailed;

  const rate = stats?.policyRate ?? null;
  const hox = stats?.housePriceIndex ?? null;
  const sqm = stats?.pricePerSqm ?? null;
  const kpif = stats?.inflation ?? null;

  const cards = [
    {
      icon: PercentIcon,
      label: "Styrränta",
      sub: "Riksbanken, kvartalsvis",
      value: rate ? formatSwedishNumber(rate.latest, 2) : null,
      unit: "%",
      badge: rate ? formatRateChangeBadge(rate.change12mPtPct) : null,
      chart: rate ? <InterestRateChart values={rate.values} quarterLabels={rate.quarterLabels} /> : null,
      source: "Riksbanken",
      updated: rate?.latestDate,
    },
    {
      icon: TrendingUpIcon,
      label: "Bostadspriser",
      sub: "Prisindex för småhus, senaste 12 månaderna",
      value: hox?.yoyChangePct !== null && hox?.yoyChangePct !== undefined
        ? `${hox.yoyChangePct > 0 ? "+" : ""}${formatSwedishNumber(hox.yoyChangePct)}`
        : null,
      unit: "% / år",
      badge: hox ? trendBadge(hox.yoyChangePct) : null,
      chart: hox ? <HousePriceChart values={hox.values} quarterLabels={hox.quarterLabels} /> : null,
      source: "SCB Fastighetsprisindex",
      updated: hox?.asOf,
    },
    {
      icon: BuildingIcon,
      label: "Kvadratmeterpris",
      sub: "Bostadsrätter, senaste 12 månaderna",
      value: sqm ? sqm.areas.find((a) => a.name === "Riksgenomsnitt")?.pricePerM2.toLocaleString("sv-SE") ?? null : null,
      unit: "kr/kvm i riket",
      badge: sqm?.asOf ? capitalize(sqm.asOf) : null,
      chart: sqm ? <SqmPriceChart areas={sqm.areas} /> : null,
      source: "Svensk Mäklarstatistik",
      updated: sqm?.asOf,
    },
    {
      icon: ChartIcon,
      label: "Inflation",
      sub: "KPIF, årstakt",
      value: kpif ? formatSwedishNumber(kpif.latest) : null,
      unit: "%",
      badge: kpif ? inflationBadge(kpif.latest) : null,
      chart: kpif ? <InflationChart values={kpif.values} monthLabels={kpif.monthLabels} /> : null,
      source: "SCB (KPIF)",
      updated: kpif?.latestMonth,
    },
  ];

  return (
    <section id="marknadsinsikter" aria-label="Marknadsinsikter" className="relative scroll-mt-24">
      <div className={`${LANDING_CONTAINER} ${intro ? "py-20 lg:py-28" : "py-14 lg:py-20"}`}>
        {intro && (
          <SectionIntro
            icon={ChartIcon}
            label="Marknadsinsikter"
            title="Siffrorna som styr marknaden"
            description="Samma datapunkter som ligger till grund för varje analys – hämtade live från Riksbanken, SCB och Svensk Mäklarstatistik."
          />
        )}

        <div className={`grid gap-5 lg:grid-cols-2 ${intro ? "mt-12" : ""}`}>
          {cards.map(({ icon: Icon, label, sub, value, unit, badge, chart, source, updated }, i) => (
            <Reveal key={label} variant="up" delay={i * 90} className="h-full">
              <div className="flex h-full flex-col rounded-[22px] border border-ka-line bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)] transition duration-300 hover:border-ka-green-700/25 sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ka-green-800 text-white">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div>
                      <p className="text-[15px] font-bold text-ka-ink">{label}</p>
                      <p className="text-xs text-ka-muted">{sub}</p>
                    </div>
                  </div>
                  {badge && (
                    <span className="rounded-full bg-ka-sage/70 px-2.5 py-1 text-[11px] font-semibold text-ka-green-900">
                      {badge}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-[34px] font-bold leading-none tracking-tight text-ka-ink">
                    {value ?? (loading ? "" : "—")}
                  </span>
                  <span className="text-sm text-ka-muted">{unit}</span>
                </div>

                {chart ?? (loading ? <ChartSkeleton /> : <ChartUnavailable />)}

                <p className="mt-auto pt-4 text-[11.5px] text-ka-muted">
                  Källa: {source}
                  {updated ? ` · Uppdaterad ${updated}` : ""}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
