import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatInt } from "@/lib/admin/stats";

/**
 * The statistics page's charts: plain SVG, no charting library. Colours are not
 * set here but by the stylesheet (admin.scss, `.series-<key>`), so they follow
 * the master variables like everything else. Each chart is an image with a text
 * summary for screen readers; the exact numbers are always also in the text
 * beside it (the legend, the cards), so nothing depends on seeing a colour or
 * hovering.
 *
 * A chart is drawn at the width it actually has, not at a fixed size that is
 * then scaled to fit: on a phone a scaled chart would shrink its labels to
 * a few pixels.
 */

// ── scales ───────────────────────────────────────────────────────────────────

/** A y axis: from `min` (0 unless there are negative numbers) to a round `max`, in steps of `step`. */
export interface Scale {
  min: number;
  max: number;
  step: number;
}

/** The size of a step that gives about `ticks` of them over `span`: 1, 2, 5 or 10 times a power of ten. */
function niceStep(span: number, integer: boolean, ticks: number): number {
  const rough = span / ticks;
  const power = 10 ** Math.floor(Math.log10(rough));
  const f = rough / power;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * power;
  return integer ? Math.max(1, Math.ceil(step)) : step;
}

/** A y axis from 0 to a round maximum. `integer` keeps the steps whole, for counts. */
export function niceScale(max: number, integer = false, ticks = 4): Scale {
  if (!(max > 0)) return { min: 0, max: ticks, step: 1 };
  const step = niceStep(max, integer, ticks);
  return { min: 0, max: step * Math.ceil(max / step), step };
}

/** Like niceScale, for numbers that may go below zero (a result that is a loss for a while). */
export function niceRange(min: number, max: number, integer = false, ticks = 4): Scale {
  if (!(min < 0)) return niceScale(max, integer, ticks);
  const step = niceStep(Math.max(max, 0) - min, integer, ticks);
  return { min: step * Math.floor(min / step), max: max > 0 ? step * Math.ceil(max / step) : 0, step };
}

function tickValues({ min, max, step }: Scale): number[] {
  const values: number[] = [];
  for (let v = min; v <= max + step / 1000; v += step) values.push(Math.round(v * 1000) / 1000);
  return values;
}

/** Indexes of the x labels to print: evenly spread, always including the last day. */
function labelIndexes(n: number, wanted: number): number[] {
  if (n <= wanted) return Array.from({ length: n }, (_, i) => i);
  const step = Math.ceil((n - 1) / (wanted - 1));
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i -= step) out.unshift(i);
  return out;
}

// ── geometry, for the width the chart actually has ───────────────────────────

interface Geometry {
  W: number;
  H: number;
  L: number;
  R: number;
  T: number;
  innerW: number;
  innerH: number;
  /** how many x labels fit */
  xLabels: number;
}

const DEFAULT_WIDTH = 720; // what the server draws; the browser measures and redraws

function geometry(width: number): Geometry {
  const narrow = width < 480;
  const W = width;
  const H = narrow ? 215 : 250;
  const L = narrow ? 38 : 46;
  const R = 12;
  const T = 14;
  const B = 30;
  return { W, H, L, R, T, innerW: W - L - R, innerH: H - T - B, xLabels: narrow ? 4 : width < 640 ? 5 : 6 };
}

/** The drawn width of an svg element, kept up to date as the window or the layout changes. */
function useWidth() {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const measured = Math.round(el.getBoundingClientRect().width);
      if (measured > 0) setWidth(Math.max(260, measured));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** `x` says where the i-th label belongs: on a point of a line, or at the middle of a bar. */
function Axes({ g, labels, scale, x }: { g: Geometry; labels: string[]; scale: Scale; x: (i: number) => number }) {
  const y = (v: number) => g.T + g.innerH - ((v - scale.min) / (scale.max - scale.min)) * g.innerH;
  const n = labels.length;
  return (
    <g className="chart-axes">
      {tickValues(scale).map((v) => (
        <g key={v}>
          <line className={v === 0 && scale.min < 0 ? "chart-grid is-zero" : "chart-grid"} x1={g.L} x2={g.W - g.R} y1={y(v)} y2={y(v)} />
          <text className="chart-tick" x={g.L - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">
            {formatInt(v)}
          </text>
        </g>
      ))}
      {labelIndexes(n, g.xLabels).map((i) => (
        <text key={i} className="chart-tick" x={x(i)} y={g.H - 9} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>
          {labels[i]}
        </text>
      ))}
    </g>
  );
}

/** What is under the pointer, as an index into the data, or null. */
function indexAt(event: ReactPointerEvent<SVGElement>, svg: SVGSVGElement | null, g: Geometry, n: number, spread: "points" | "bars"): number | null {
  if (!svg || n === 0) return null;
  const box = svg.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * g.W;
  if (x < g.L - 6 || x > g.W - g.R + 6) return null;
  const index = spread === "points" ? Math.round(n > 1 ? ((x - g.L) / g.innerW) * (n - 1) : 0) : Math.floor(((x - g.L) / g.innerW) * n);
  return Math.min(n - 1, Math.max(0, index));
}

function Tooltip({ g, x, lines, width: fixedWidth }: { g: Geometry; x: number; lines: { text: string; className?: string; strong?: boolean }[]; width?: number }) {
  // wide enough for the longest line (about 6.6 px a character at this size), never narrower than the usual 150
  const width = fixedWidth ?? Math.max(150, Math.ceil(Math.max(...lines.map((line) => line.text.length)) * 6.6 + 24));
  const height = 14 + lines.length * 17;
  const left = Math.min(Math.max(x - width / 2, g.L), g.W - g.R - width);
  return (
    <g className="chart-tooltip" pointerEvents="none">
      <rect x={left} y={g.T} width={width} height={height} rx={8} />
      {lines.map((line, i) => (
        <text key={i} x={left + 10} y={g.T + 18 + i * 17} className={`${line.className ?? ""} ${line.strong ? "is-strong" : ""}`}>
          {line.text}
        </text>
      ))}
    </g>
  );
}

// ── area chart: one series over time ─────────────────────────────────────────

export function AreaChart({
  labels,
  values,
  seriesKey,
  valueLabel,
  ariaLabel,
}: {
  labels: string[];
  values: number[];
  seriesKey: string;
  /** what one value counts, for the tooltip: "besökare" */
  valueLabel: string;
  ariaLabel: string;
}) {
  const [svg, width] = useWidth();
  const g = geometry(width);
  const [hover, setHover] = useState<number | null>(null);
  const scale = niceScale(Math.max(0, ...values), true);
  const n = values.length;
  const x = (i: number) => (n > 1 ? g.L + (i / (n - 1)) * g.innerW : g.L + g.innerW / 2);
  const y = (v: number) => g.T + g.innerH - (v / scale.max) * g.innerH;
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = n > 0 ? `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : "";

  return (
    <svg
      ref={svg}
      className={`chart series-${seriesKey}`}
      viewBox={`0 0 ${g.W} ${g.H}`}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={(e) => setHover(indexAt(e, svg.current, g, n, "points"))}
      onPointerLeave={() => setHover(null)}
    >
      <Axes g={g} labels={labels} scale={scale} x={x} />
      <path className="chart-area" d={area} />
      <path className="chart-line" d={line} />
      {/* one counted day is a point, not a line */}
      {n === 1 && <circle className="chart-dot" cx={x(0)} cy={y(values[0])} r={4.5} />}
      {hover !== null && (
        <>
          <line className="chart-cursor" x1={x(hover)} x2={x(hover)} y1={g.T} y2={g.T + g.innerH} />
          <circle className="chart-dot" cx={x(hover)} cy={y(values[hover])} r={4.5} />
          <Tooltip g={g} x={x(hover)} lines={[{ text: labels[hover] }, { text: `${formatInt(values[hover])} ${valueLabel}`, strong: true }]} />
        </>
      )}
    </svg>
  );
}

// ── line chart: several series over time ─────────────────────────────────────

export interface LineSeries {
  key: string;
  label: string;
  values: number[];
  /** an SVG dash pattern, so a line can be told apart by more than its colour */
  dash?: string;
  /** a thicker line, for the one that matters most */
  heavy?: boolean;
}

/** A series may be shorter than the labels (a comparison run over fewer months); it just stops. */
export function LineChart({ labels, series, ariaLabel }: { labels: string[]; series: LineSeries[]; ariaLabel: string }) {
  const [svg, width] = useWidth();
  const g = geometry(width);
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const top = Math.max(0, ...series.map((s) => Math.max(0, ...s.values)));
  const bottom = Math.min(0, ...series.map((s) => Math.min(0, ...s.values)));
  const scale = niceRange(bottom, top, top - bottom >= 8);
  const x = (i: number) => (n > 1 ? g.L + (i / (n - 1)) * g.innerW : g.L + g.innerW / 2);
  const y = (v: number) => g.T + g.innerH - ((v - scale.min) / (scale.max - scale.min)) * g.innerH;
  const path = (values: number[]) => values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg
      ref={svg}
      className="chart"
      viewBox={`0 0 ${g.W} ${g.H}`}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={(e) => setHover(indexAt(e, svg.current, g, n, "points"))}
      onPointerLeave={() => setHover(null)}
    >
      <Axes g={g} labels={labels} scale={scale} x={x} />
      {series.map((s) => (
        <path key={s.key} className={`chart-line series-${s.key}${s.heavy ? " is-heavy" : ""}`} d={path(s.values)} strokeDasharray={s.dash} />
      ))}
      {hover !== null && (
        <>
          <line className="chart-cursor" x1={x(hover)} x2={x(hover)} y1={g.T} y2={g.T + g.innerH} />
          {series
            .filter((s) => hover < s.values.length)
            .map((s) => (
              <circle key={s.key} className={`chart-dot series-${s.key}`} cx={x(hover)} cy={y(s.values[hover])} r={3.5} />
            ))}
          <Tooltip
            g={g}
            x={x(hover)}
            lines={[
              { text: labels[hover] },
              ...series.filter((s) => hover < s.values.length).map((s) => ({ text: `${s.label}: ${formatInt(s.values[hover])}`, className: `legend-text series-${s.key}` })),
            ]}
          />
        </>
      )}
    </svg>
  );
}

// ── stacked bars: several series per day ─────────────────────────────────────

export interface BarSeries {
  key: string;
  label: string;
  values: number[];
}

export function StackedBars({ labels, series, valueLabel, ariaLabel }: { labels: string[]; series: BarSeries[]; valueLabel: string; ariaLabel: string }) {
  const [svg, width] = useWidth();
  const g = geometry(width);
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + s.values[i], 0));
  const scale = niceScale(Math.max(0, ...totals), true);
  const y = (v: number) => g.T + g.innerH - (v / scale.max) * g.innerH;
  const slot = n > 0 ? g.innerW / n : g.innerW;
  const barWidth = Math.max(1.5, slot * 0.7);
  const cx = (i: number) => g.L + slot * (i + 0.5);

  return (
    <svg
      ref={svg}
      className="chart"
      viewBox={`0 0 ${g.W} ${g.H}`}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={(e) => setHover(indexAt(e, svg.current, g, n, "bars"))}
      onPointerLeave={() => setHover(null)}
    >
      <Axes g={g} labels={labels} scale={scale} x={cx} />
      {labels.map((_, i) => {
        let top = y(0);
        return (
          <g key={i} className={hover === i ? "chart-bar is-hovered" : "chart-bar"}>
            {series.map((s) => {
              const height = (s.values[i] / scale.max) * g.innerH;
              top -= height;
              return height > 0 ? <rect key={s.key} className={`series-${s.key}`} x={cx(i) - barWidth / 2} y={top} width={barWidth} height={height} /> : null;
            })}
          </g>
        );
      })}
      {hover !== null && (
        <Tooltip
          g={g}
          x={cx(hover)}
          lines={[
            { text: labels[hover] },
            ...series.filter((s) => s.values[hover] > 0).map((s) => ({ text: `${s.label}: ${formatInt(s.values[hover])}`, className: `legend-text series-${s.key}` })),
            { text: `Totalt ${formatInt(totals[hover])} ${valueLabel}`, strong: true },
          ]}
        />
      )}
    </svg>
  );
}

// ── donut: shares of a whole ─────────────────────────────────────────────────

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
}

export function Donut({ slices, centerValue, centerLabel, ariaLabel }: { slices: DonutSlice[]; centerValue: string; centerLabel: string; ariaLabel: string }) {
  const size = 188;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const visible = slices.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 3 : 0; // a sliver of background between slices, so the edges don't rely on colour
  let offset = 0;

  return (
    <svg className="donut" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
      <circle className="donut-track" cx={size / 2} cy={size / 2} r={radius} />
      {total > 0 &&
        visible.map((slice) => {
          const length = (slice.value / total) * circumference;
          const dash = Math.max(0, length - gap);
          const start = offset;
          offset += length;
          return (
            <circle
              key={slice.key}
              className={`donut-slice series-${slice.key}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-start}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      <text className="donut-value" x={size / 2} y={size / 2 - 2} textAnchor="middle">
        {centerValue}
      </text>
      <text className="donut-caption" x={size / 2} y={size / 2 + 18} textAnchor="middle">
        {centerLabel}
      </text>
    </svg>
  );
}
