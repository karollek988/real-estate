"use client";

import { Reveal } from "@/components/Reveal";
import { SectionBackground } from "@/components/SectionBackground";
import { SectionIntro } from "@/components/SectionIntro";
import {
  BuildingIcon,
  ChartIcon,
  PercentIcon,
  TrendingUpIcon,
} from "@/components/icons";

const PLOT = { left: 40, right: 428, top: 14, bottom: 112 };
const LABEL_Y = 138;

function xAt(i: number, n: number) {
  return PLOT.left + (i * (PLOT.right - PLOT.left)) / (n - 1);
}

function yAt(v: number, min: number, max: number) {
  return PLOT.bottom - ((v - min) / (max - min)) * (PLOT.bottom - PLOT.top);
}

function GridLine({ y, label }: { y: number; label: string }) {
  return (
    <g>
      <line
        x1={PLOT.left}
        x2={PLOT.right}
        y1={y}
        y2={y}
        stroke="rgba(255,255,255,0.08)"
        strokeDasharray="3 4"
      />
      <text x={PLOT.left - 7} y={y + 3} textAnchor="end" fontSize="8.5" fill="#7c847f">
        {label}
      </text>
    </g>
  );
}

/* Styrränta — kvartalsvis, stegkurva */
const RATE_VALUES = [4.0, 4.0, 3.75, 3.5, 3.25, 2.75, 2.5, 2.25, 2.0, 1.75];
const RATE_MIN = 0.5;
const RATE_MAX = 4.5;

function InterestRateChart() {
  const points = RATE_VALUES.map((v, i) => ({
    x: xAt(i, RATE_VALUES.length),
    y: yAt(v, RATE_MIN, RATE_MAX),
  }));
  const d = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `H ${p.x} V ${p.y}`))
    .join(" ");
  const last = points[points.length - 1];

  return (
    <svg viewBox="0 0 440 148" className="mt-4 w-full" role="img" aria-label="Styrräntans utveckling 2024 till 2026, från 4,0 till 1,75 procent">
      {[4, 3, 2, 1].map((v) => (
        <GridLine key={v} y={yAt(v, RATE_MIN, RATE_MAX)} label={`${v}%`} />
      ))}
      <path
        d={d}
        pathLength={1}
        className="chart-line"
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <g key={p.x}>
          <circle className="chart-fade" cx={p.x} cy={p.y} r="2.2" fill="#4ade80" />
          <circle cx={p.x} cy={p.y} r="9" fill="transparent">
            <title>{`${RATE_VALUES[i].toFixed(2).replace(".", ",")} %`}</title>
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
        fill="#e5e5e5"
      >
        1,75%
      </text>
      {[
        { label: "2024", i: 0 },
        { label: "2025", i: 4 },
        { label: "2026", i: 8 },
      ].map(({ label, i }) => (
        <text key={label} x={xAt(i, RATE_VALUES.length)} y={LABEL_Y} textAnchor="middle" fontSize="8.5" fill="#7c847f">
          {label}
        </text>
      ))}
    </svg>
  );
}

/* Bostadsprisindex — 12 månader, ytdiagram */
const HOX_MONTHS = ["Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "Maj"];
const HOX_VALUES = [100, 99.2, 100.4, 101.2, 100.7, 101.8, 102.6, 102.1, 103.3, 103.9, 104.7, 105.6, 106.4];
const HOX_MIN = 96;
const HOX_MAX = 108;

function HousePriceChart() {
  const points = HOX_VALUES.map((v, i) => ({
    x: xAt(i, HOX_VALUES.length),
    y: yAt(v, HOX_MIN, HOX_MAX),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1].x} ${PLOT.bottom} L ${points[0].x} ${PLOT.bottom} Z`;

  return (
    <svg viewBox="0 0 440 148" className="mt-4 w-full" role="img" aria-label="Bostadsprisindex senaste 12 månaderna, upp 6,4 procent">
      <defs>
        <linearGradient id="hox-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(74,222,128,0.26)" />
          <stop offset="100%" stopColor="rgba(74,222,128,0)" />
        </linearGradient>
      </defs>
      {[108, 104, 100, 96].map((v) => (
        <GridLine key={v} y={yAt(v, HOX_MIN, HOX_MAX)} label={`${v}`} />
      ))}
      <path className="chart-area" d={area} fill="url(#hox-area)" />
      <path
        d={line}
        pathLength={1}
        className="chart-line"
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={p.x} cx={p.x} cy={p.y} r="9" fill="transparent">
          <title>{`${HOX_MONTHS[i]}: ${HOX_VALUES[i].toFixed(1).replace(".", ",")}`}</title>
        </circle>
      ))}
      <circle
        className="chart-fade"
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2.6"
        fill="#4ade80"
      />
      <text
        className="chart-fade"
        x={points[points.length - 1].x - 2}
        y={points[points.length - 1].y - 9}
        textAnchor="end"
        fontSize="9"
        fontWeight="600"
        fill="#e5e5e5"
      >
        106,4
      </text>
      {HOX_MONTHS.map((month, i) =>
        i % 2 === 0 ? (
          <text key={i} x={points[i].x} y={LABEL_Y} textAnchor="middle" fontSize="8.5" fill="#7c847f">
            {month}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/* Kvadratmeterpris — horisontella staplar per stad */
const SQM_PRICES = [
  { name: "Stockholm", value: 89400 },
  { name: "Uppsala", value: 58900 },
  { name: "Göteborg", value: 56700 },
  { name: "Riksgenomsnitt", value: 52345 },
  { name: "Malmö", value: 41200 },
];
const SQM_MAX = 96000;

function SqmPriceChart() {
  return (
    <div className="mt-5 space-y-4">
      {SQM_PRICES.map(({ name, value }, i) => (
        <div key={name}>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-neutral-300">{name}</span>
            <span className="font-semibold text-neutral-100">
              {value.toLocaleString("sv-SE")} kr
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="chart-bar h-full rounded-full bg-gradient-to-r from-green-600 to-green-400"
              style={
                {
                  width: `${(value / SQM_MAX) * 100}%`,
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

/* Inflation (KPIF) — 12 månader, linje med målnivå */
const KPIF_MONTHS = HOX_MONTHS;
const KPIF_VALUES = [2.6, 2.4, 2.3, 2.2, 2.0, 1.9, 2.1, 2.0, 1.8, 1.9, 2.0, 1.8, 1.9];
const KPIF_MIN = 0.5;
const KPIF_MAX = 3.5;

function InflationChart() {
  const points = KPIF_VALUES.map((v, i) => ({
    x: xAt(i, KPIF_VALUES.length),
    y: yAt(v, KPIF_MIN, KPIF_MAX),
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const targetY = yAt(2, KPIF_MIN, KPIF_MAX);

  return (
    <svg viewBox="0 0 440 148" className="mt-4 w-full" role="img" aria-label="Inflationen KPIF senaste 12 månaderna, 1,9 procent, nära målet på 2 procent">
      {[3, 1].map((v) => (
        <GridLine key={v} y={yAt(v, KPIF_MIN, KPIF_MAX)} label={`${v}%`} />
      ))}
      <line
        x1={PLOT.left}
        x2={PLOT.right}
        y1={targetY}
        y2={targetY}
        stroke="rgba(74,222,128,0.45)"
        strokeDasharray="5 4"
      />
      <text x={PLOT.left - 7} y={targetY + 3} textAnchor="end" fontSize="8.5" fill="#7c847f">
        2%
      </text>
      <text x={PLOT.right} y={targetY - 6} textAnchor="end" fontSize="8.5" fill="#7c847f">
        Inflationsmål
      </text>
      <path
        d={line}
        pathLength={1}
        className="chart-line"
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <g key={p.x}>
          <circle className="chart-fade" cx={p.x} cy={p.y} r="2.2" fill="#4ade80" />
          <circle cx={p.x} cy={p.y} r="9" fill="transparent">
            <title>{`${KPIF_MONTHS[i]}: ${KPIF_VALUES[i].toFixed(1).replace(".", ",")} %`}</title>
          </circle>
        </g>
      ))}
      {KPIF_MONTHS.map((month, i) =>
        i % 2 === 0 ? (
          <text key={i} x={points[i].x} y={LABEL_Y} textAnchor="middle" fontSize="8.5" fill="#7c847f">
            {month}
          </text>
        ) : null,
      )}
    </svg>
  );
}

const INSIGHT_CARDS = [
  {
    icon: PercentIcon,
    label: "Styrränta",
    sub: "Riksbanken, kvartalsvis",
    value: "1,75",
    unit: "%",
    badge: "−0,25 pp",
    chart: <InterestRateChart />,
    source: "Riksbanken",
  },
  {
    icon: TrendingUpIcon,
    label: "Bostadspriser",
    sub: "Prisindex, senaste 12 månaderna",
    value: "+6,4",
    unit: "% / år",
    badge: "Stigande",
    chart: <HousePriceChart />,
    source: "Prisindex",
  },
  {
    icon: BuildingIcon,
    label: "Kvadratmeterpris",
    sub: "Lägenheter, juni 2026",
    value: "52 345",
    unit: "kr/kvm i riket",
    badge: "Juni 2026",
    chart: <SqmPriceChart />,
    source: "Transaktionsdata",
  },
  {
    icon: ChartIcon,
    label: "Inflation",
    sub: "KPIF, årstakt",
    value: "1,9",
    unit: "%",
    badge: "Nära målet",
    chart: <InflationChart />,
    source: "SCB",
  },
];

export function InsightsSection() {
  return (
    <section id="marknadsinsikter" className="relative scroll-mt-24">
      <SectionBackground src="/marknads-instinkter.png" />
      <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20">
        <SectionIntro
          icon={ChartIcon}
          label="Marknadsinsikter"
          title="Siffrorna som styr marknaden"
          description="Samma datapunkter som ligger till grund för varje analys – uppdaterade och samlade på ett ställe."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {INSIGHT_CARDS.map(({ icon: Icon, label, sub, value, unit, badge, chart, source }, i) => (
            <Reveal key={label} variant="up" delay={i * 90} className="h-full">
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:border-white/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                      <Icon className="h-[18px] w-[18px] text-green-400" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-neutral-500">{sub}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-green-500/25 bg-green-500/10 px-2.5 py-1 text-[11px] font-semibold text-green-400">
                    {badge}
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-[28px] font-bold tracking-tight">{value}</span>
                  <span className="text-sm text-neutral-500">{unit}</span>
                </div>

                {chart}

                <p className="mt-auto pt-4 text-[11px] text-neutral-600">
                  Källa: {source} · Platshållardata
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
