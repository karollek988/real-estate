"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { LANDING_CONTAINER } from "@/components/landing/container";
import {
  BuildingIcon,
  ChartIcon,
  PercentIcon,
  TrendingUpIcon,
} from "@/components/icons";
import { LOCALES, type AppLocale } from "@/i18n/locales";
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

/** A number written the way the reader's language writes it (1,5 or 1.5), with a fixed number of decimals. */
function formatNumber(n: number, locale: AppLocale, decimals = 1): string {
  return new Intl.NumberFormat(LOCALES[locale].formatLocale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

/** What the charts need to write labels in the reader's language. */
type Words = {
  locale: AppLocale;
  /** "2024K3" -> the quarter as the language writes it */
  quarter: (label: string) => string;
  /** "2025M09" -> "Sep" */
  month: (label: string) => string;
};

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

function ChartUnavailable({ text }: { text: string }) {
  return (
    <div className="mt-4 flex h-[148px] w-full items-center justify-center rounded-lg border border-ka-line text-xs text-ka-muted">
      {text}
    </div>
  );
}

/* Styrränta — kvartalsvis, stegkurva */
function InterestRateChart({ values, quarterLabels, words, label }: { values: number[]; quarterLabels: string[]; words: Words; label: string }) {
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
      aria-label={label}
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
            <title>{`${words.quarter(quarterLabels[i])}: ${formatNumber(values[i], words.locale, 2)} %`}</title>
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
        {formatNumber(values[values.length - 1], words.locale, 2)}%
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
function HousePriceChart({ values, quarterLabels, words, label }: { values: number[]; quarterLabels: string[]; words: Words; label: string }) {
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
      aria-label={label}
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
          <title>{`${words.quarter(quarterLabels[i])}: ${values[i]}`}</title>
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
      {quarterLabels.map((quarterLabel, i) =>
        i % 2 === 0 ? (
          <text key={i} x={points[i].x} y={LABEL_Y} textAnchor="middle" fontSize="8.5" fill={LABEL}>
            {words.quarter(quarterLabel)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/* Kvadratmeterpris — horisontella staplar per stad */
function SqmPriceChart({ areas, locale, nationalAverage }: { areas: { name: string; pricePerM2: number }[]; locale: AppLocale; nationalAverage: string }) {
  const max = Math.max(...areas.map((a) => a.pricePerM2)) * 1.07;
  return (
    <div className="mt-5 space-y-4">
      {areas.map(({ name, pricePerM2 }, i) => (
        <div key={name}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-ka-muted">{name === SOURCE_NATIONAL_AVERAGE ? nationalAverage : name}</span>
            <span className="font-semibold text-ka-ink">
              {pricePerM2.toLocaleString(LOCALES[locale].formatLocale)} kr
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
function InflationChart({ values, monthLabels, words, label, targetLabel }: { values: number[]; monthLabels: string[]; words: Words; label: string; targetLabel: string }) {
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
      aria-label={label}
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
        {targetLabel}
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
            <title>{`${words.month(monthLabels[i])}: ${formatNumber(values[i], words.locale)} %`}</title>
          </circle>
        </g>
      ))}
      {monthLabels.map((month, i) =>
        i % 2 === 0 ? (
          <text key={i} x={points[i].x} y={LABEL_Y} textAnchor="middle" fontSize="8.5" fill={LABEL}>
            {words.month(month)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** The name Svensk Mäklarstatistik gives the figure for all of Sweden; the page shows it in the reader's language. */
const SOURCE_NATIONAL_AVERAGE = "Riksgenomsnitt";

function trendBadge(changePct: number | null): "unknown" | "rising" | "falling" | "stable" {
  if (changePct === null) return "unknown";
  if (changePct > 0.5) return "rising";
  if (changePct < -0.5) return "falling";
  return "stable";
}

function inflationBadge(latest: number): "near" | "above" | "below" {
  const distance = latest - 2;
  if (Math.abs(distance) <= 0.3) return "near";
  return distance > 0 ? "above" : "below";
}

function formatRateChangeBadge(changePtPct: number | null, locale: AppLocale, unit: string): string {
  if (changePtPct === null) return "—";
  if (changePtPct === 0) return `±0 ${unit}`;
  const sign = changePtPct > 0 ? "+" : "−";
  return `${sign}${formatNumber(Math.abs(changePtPct), locale, 2)} ${unit}`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * The date Svensk Mäklarstatistik prints ("8 juli 2026", always Swedish) written with the month names of the
 * reader's language. A date that does not look like that is shown as it is.
 */
function localizeSourceDate(text: string, sourceMonths: string[], monthsLong: string[]): string {
  const match = text.match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (!match) return text;
  const month = sourceMonths.indexOf(match[2].toLowerCase());
  return month === -1 ? text : `${match[1]} ${monthsLong[month]} ${match[3]}`;
}

/** Live market statistics (styrränta, bostadspriser, kvm-pris, inflation) via /api/market-stats - the body of /prisutveckling. */
export function InsightsSection({ intro = true }: { intro?: boolean } = {}) {
  const t = useTranslations("insights");
  const locale = useLocale() as AppLocale;
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

  // the twelve month names are looked up by number, which the typed keys of t() cannot express
  const monthName = t as unknown as (key: string) => string;
  const words: Words = {
    locale,
    quarter: (label) => {
      const match = label.match(/^(\d{4})K(\d)$/);
      return match ? t("quarter", { year: match[1], quarter: match[2] }) : label;
    },
    month: (label) => {
      const match = label.match(/^\d{4}M(\d{2})$/);
      return match ? (monthName(`months.${match[1]}`) ?? label) : label;
    },
  };
  const sourceMonths = t("sourceMonths").split(",");
  const monthsLong = t("monthsLong").split(",");
  const sourceDate = (date: string | null | undefined) => (date ? localizeSourceDate(date, sourceMonths, monthsLong) : undefined);

  const cards = [
    {
      icon: PercentIcon,
      label: t("cards.policyRate.label"),
      sub: t("cards.policyRate.sub"),
      value: rate ? formatNumber(rate.latest, locale, 2) : null,
      unit: t("cards.policyRate.unit"),
      badge: rate ? formatRateChangeBadge(rate.change12mPtPct, locale, t("percentagePoints")) : null,
      chart: rate ? (
        <InterestRateChart
          values={rate.values}
          quarterLabels={rate.quarterLabels}
          words={words}
          label={t("chartLabels.policyRate", { value: formatNumber(rate.latest, locale, 2) })}
        />
      ) : null,
      source: t("cards.policyRate.source"),
      updated: rate?.latestDate,
    },
    {
      icon: TrendingUpIcon,
      label: t("cards.housePrices.label"),
      sub: t("cards.housePrices.sub"),
      value: hox?.yoyChangePct !== null && hox?.yoyChangePct !== undefined
        ? `${hox.yoyChangePct > 0 ? "+" : ""}${formatNumber(hox.yoyChangePct, locale)}`
        : null,
      unit: t("cards.housePrices.unit"),
      badge: hox ? t(`trend.${trendBadge(hox.yoyChangePct)}`) : null,
      chart: hox ? (
        <HousePriceChart
          values={hox.values}
          quarterLabels={hox.quarterLabels}
          words={words}
          label={t("chartLabels.housePrices", { value: hox.values[hox.values.length - 1] })}
        />
      ) : null,
      source: t("cards.housePrices.source"),
      updated: hox ? words.quarter(hox.asOf) : undefined,
    },
    {
      icon: BuildingIcon,
      label: t("cards.pricePerSqm.label"),
      sub: t("cards.pricePerSqm.sub"),
      value: sqm ? sqm.areas.find((a) => a.name === SOURCE_NATIONAL_AVERAGE)?.pricePerM2.toLocaleString(LOCALES[locale].formatLocale) ?? null : null,
      unit: t("cards.pricePerSqm.unit"),
      badge: sqm?.asOf ? capitalize(sourceDate(sqm.asOf) ?? sqm.asOf) : null,
      chart: sqm ? <SqmPriceChart areas={sqm.areas} locale={locale} nationalAverage={t("nationalAverage")} /> : null,
      source: t("cards.pricePerSqm.source"),
      updated: sourceDate(sqm?.asOf),
    },
    {
      icon: ChartIcon,
      label: t("cards.inflation.label"),
      sub: t("cards.inflation.sub"),
      value: kpif ? formatNumber(kpif.latest, locale) : null,
      unit: t("cards.inflation.unit"),
      badge: kpif ? t(`inflationBadge.${inflationBadge(kpif.latest)}`) : null,
      chart: kpif ? (
        <InflationChart
          values={kpif.values}
          monthLabels={kpif.monthLabels}
          words={words}
          label={t("chartLabels.inflation", { value: formatNumber(kpif.latest, locale) })}
          targetLabel={t("inflationTarget")}
        />
      ) : null,
      source: t("cards.inflation.source"),
      updated: kpif?.latestMonth,
    },
  ];

  return (
    <section id="marknadsinsikter" aria-label={t("label")} className="relative scroll-mt-24">
      <div className={`${LANDING_CONTAINER} ${intro ? "py-20 lg:py-28" : "py-14 lg:py-20"}`}>
        {intro && (
          <SectionIntro
            icon={ChartIcon}
            label={t("eyebrow")}
            title={t("title")}
            description={t("description")}
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

                {chart ?? (loading ? <ChartSkeleton /> : <ChartUnavailable text={t("unavailable")} />)}

                <p className="mt-auto pt-4 text-[11.5px] text-ka-muted">
                  {updated ? t("sourceLineUpdated", { source, date: updated }) : t("sourceLine", { source })}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
