/**
 * Real numbers for the acquisition model: what the site has measured about where new visitors come
 * from (the ka_src cookie, only for visitors who accepted it), and the starting values for the channel
 * boxes that follow from it. No React, no database access - the page loads the rows (lib/admin/acquisitionData.ts)
 * and these functions do the arithmetic, so markov.verify.mjs can test them.
 *
 * What is measured, and what it is turned into:
 *   - per day, channel and source: new visitors who had accepted the cookie            (arrivals)
 *   - per day: how many accepted and how many declined the banner                      (consent)
 * Only the first is a count of visitors by channel, and it leaves out everyone who declined. So the
 * estimate scales it up: everyone new = those counted + those who declined, and every channel gets its
 * share (among the counted) of that. This assumes people who declined arrive from the same places as
 * people who accepted. Then it is turned into a month: the window is at most 30 days, scaled to 30.44.
 */
import { CHANNEL_IDS, DEFAULT_ACQUISITION, type ChannelId } from "./acquisition";
import type { DayStats } from "@/lib/admin/stats";
import { DEFAULT_FIELDS, FIELD, percentText, type Fields } from "./fields";
import { PACKAGE_IDS, type PackageId } from "./finance";

/** The newest this many days (today included) are used. */
export const WINDOW_DAYS = 30;
/** Below this many counted new visitors, or this many days of measuring, the numbers say too little to start from. */
export const MIN_VISITORS = 20;
export const MIN_DAYS = 7;
/** Below this the numbers are used but called thin. */
export const THIN_VISITORS = 100;
export const DAYS_PER_MONTH = 30.4375;

export interface ArrivalRow {
  day: string;
  channel: string;
  source: string;
  visitors: number;
}

export interface ConsentRow {
  day: string;
  accepted: number;
  declined: number;
}

export interface MeasuredAcquisition {
  /** the last day (today, Swedish time) and the window the numbers cover: `from` to `today`, `days` long */
  today: string;
  from: string;
  days: number;
  /** the first day anything was counted, or null while nothing has been */
  since: string | null;
  /** new visitors who accepted the cookie, by channel, over the window */
  arrivals: Record<ChannelId, number>;
  /** the same by source, for the channels' biggest sources */
  sources: { channel: ChannelId; source: string; visitors: number }[];
  /** banner choices over the window */
  accepted: number;
  declined: number;
  /** true for the development-only sample data */
  demo: boolean;
}

export type MeasuredResult =
  | { status: "ok"; measured: MeasuredAcquisition }
  | { status: "unconfigured" } // the database settings are missing (local development)
  | { status: "missing_tables" } // the acquisition migration has not been applied
  | { status: "error"; message: string };

// ── days ─────────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
export const shiftDay = (day: string, by: number) => new Date((dayNumber(day) + by) * DAY_MS).toISOString().slice(0, 10);

// ── the rows, summed ─────────────────────────────────────────────────────────

const isChannel = (value: string): value is ChannelId => (CHANNEL_IDS as readonly string[]).includes(value);

/** Sums the database rows over the newest WINDOW_DAYS (rows outside it, and rows with an unknown channel, are left out). */
export function buildMeasured(arrivalRows: ArrivalRow[], consentRows: ConsentRow[], firstDay: string | null, today: string, demo = false): MeasuredAcquisition {
  const windowStart = shiftDay(today, -(WINDOW_DAYS - 1));
  const from = firstDay && firstDay > windowStart ? firstDay : windowStart;
  const days = firstDay ? Math.max(1, dayNumber(today) - dayNumber(from) + 1) : 0;

  const arrivals = Object.fromEntries(CHANNEL_IDS.map((id) => [id, 0])) as Record<ChannelId, number>;
  const bySource = new Map<string, { channel: ChannelId; source: string; visitors: number }>();
  for (const row of arrivalRows) {
    if (row.day < from || row.day > today || !isChannel(row.channel)) continue;
    arrivals[row.channel] += row.visitors;
    const key = `${row.channel}/${row.source}`;
    const entry = bySource.get(key) ?? { channel: row.channel, source: row.source, visitors: 0 };
    entry.visitors += row.visitors;
    bySource.set(key, entry);
  }

  let accepted = 0;
  let declined = 0;
  for (const row of consentRows) {
    if (row.day < from || row.day > today) continue;
    accepted += row.accepted;
    declined += row.declined;
  }

  return { today, from, days, since: firstDay, arrivals, sources: [...bySource.values()].sort((a, b) => b.visitors - a.visitors), accepted, declined, demo };
}

// ── from the window to a month ───────────────────────────────────────────────

export interface MeasuredEstimate {
  /** enough measured to start from (see MIN_VISITORS and MIN_DAYS) */
  usable: boolean;
  /** when not usable: what is missing, in words */
  problem: string | null;
  /** usable but few (under THIN_VISITORS): the numbers can swing a lot */
  thin: boolean;
  /** new visitors counted (accepted the cookie), who declined, and everyone new: the two added */
  counted: number;
  declined: number;
  everyone: number;
  /** everyone / counted: how much the counted are scaled up (1 when no one declined) */
  scale: number;
  /** each channel's share of the counted visitors */
  share: Record<ChannelId, number>;
  /** estimated new visitors per month, per channel, everyone included */
  perMonth: Record<ChannelId, number>;
  /** the channel's biggest source and its share of the channel */
  top: Record<ChannelId, { source: string; share: number } | null>;
}

export function estimateMonthly(measured: MeasuredAcquisition): MeasuredEstimate {
  const counted = CHANNEL_IDS.reduce((sum, id) => sum + measured.arrivals[id], 0);
  const declined = measured.declined;
  const everyone = counted + declined;
  const scale = counted > 0 ? everyone / counted : 1;
  const perMonthFactor = measured.days > 0 ? DAYS_PER_MONTH / measured.days : 0;

  const share = {} as Record<ChannelId, number>;
  const perMonth = {} as Record<ChannelId, number>;
  const top = {} as Record<ChannelId, { source: string; share: number } | null>;
  for (const id of CHANNEL_IDS) {
    share[id] = counted > 0 ? measured.arrivals[id] / counted : 0;
    perMonth[id] = measured.arrivals[id] * scale * perMonthFactor;
    const best = measured.sources.find((entry) => entry.channel === id);
    top[id] = best && measured.arrivals[id] > 0 ? { source: best.source, share: best.visitors / measured.arrivals[id] } : null;
  }

  const usable = counted >= MIN_VISITORS && measured.days >= MIN_DAYS;
  const problem = usable
    ? null
    : `För lite uppmätt än: ${counted} nya besökare som godkänt cookies under ${measured.days} ${measured.days === 1 ? "dag" : "dagar"} (minst ${MIN_VISITORS} besökare och ${MIN_DAYS} dagar behövs).`;
  return { usable, problem, thin: usable && counted < THIN_VISITORS, counted, declined, everyone, scale, share, perMonth, top };
}

// ── the starting values of the channel boxes ─────────────────────────────────

const text = (value: number) => String(value).replace(".", ",");

/** The budget that makes ads bring `visitors` a month at the example cost per visitor and doubling spend: the ad curve, solved for the budget. */
export function adsBudgetFor(visitors: number): number {
  const { costPerVisitor: c, doublingSpend: d } = DEFAULT_ACQUISITION.ads;
  if (!(visitors > 0)) return 0;
  const ceiling = d / c; // the most visitors any budget can buy
  if (visitors >= ceiling * 0.95) return 20 * d;
  return Math.round(Math.min(20 * d, (visitors * c * d) / (d - visitors * c)));
}

/**
 * The boxes the measurement fills in: each channel's level (visitors a month), growth 0 (traffic stays as it
 * is now - what a trend would be is not measured), a ceiling that stays out of the way, and a budget for
 * ads that reproduces the measured ad visitors. Quality, and everything not about visitors, is left to the
 * example values: nothing measures them yet.
 */
export function measuredFieldDefaults(estimate: MeasuredEstimate): Fields {
  const fields: Fields = {};
  for (const id of ["seo", "social", "ai"] as const) {
    const start = Math.round(estimate.perMonth[id]);
    fields[FIELD.channel(id, "start")] = text(start);
    fields[FIELD.channel(id, "growth")] = "0";
    fields[FIELD.channel(id, "cap")] = text(Math.max(DEFAULT_ACQUISITION[id].cap, start * 3));
  }
  fields[FIELD.channel("direct", "visitors")] = text(Math.round(estimate.perMonth.direct));
  fields[FIELD.channel("ads", "budget")] = text(adsBudgetFor(estimate.perMonth.ads));
  return fields;
}

// ── the real purchases ───────────────────────────────────────────────────────

/** The newest this many days of the purchase ledger give the package mix. */
export const MIX_WINDOW_DAYS = 90;
/** Below this many purchases the mix says too little to start from. */
export const MIN_PURCHASES = 10;

export interface PurchaseMix {
  /** enough purchases to start from */
  usable: boolean;
  problem: string | null;
  /** how many days the numbers cover: the newest MIX_WINDOW_DAYS, or since the first purchase if that is later */
  days: number;
  /** purchases in the window, by package (and every older or unknown package together, left out of the mix) */
  counts: Record<PackageId, number>;
  other: number;
  /** purchases of the three packages */
  total: number;
  /** real purchases a month, over the window */
  perMonth: number;
  /** each package's share of the three, as fractions that add up to exactly 1, in steps of 0,1 % */
  shares: Record<PackageId, number>;
}

/** Shares rounded to 0,1 % that add up to exactly 100 %: the largest remainders get the leftover tenths. */
function roundedShares(counts: Record<PackageId, number>, total: number): Record<PackageId, number> {
  const raw = PACKAGE_IDS.map((id) => (total > 0 ? (counts[id] / total) * 1000 : 0));
  const floors = raw.map(Math.floor);
  let left = total > 0 ? 1000 - floors.reduce((a, b) => a + b, 0) : 0;
  const order = raw.map((value, i) => ({ i, rest: value - floors[i] })).sort((a, b) => b.rest - a.rest);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return Object.fromEntries(PACKAGE_IDS.map((id, i) => [id, floors[i] / 1000])) as Record<PackageId, number>;
}

/** The package mix of the real purchases in the newest 90 days of `days` (oldest first, as the statistics page has them). */
export function purchaseMix(days: DayStats[]): PurchaseMix {
  const firstWithPurchases = days.findIndex((day) => Object.values(day.purchases).some((count) => count > 0));
  const start = Math.max(Math.max(0, firstWithPurchases), days.length - MIX_WINDOW_DAYS);
  const window = firstWithPurchases < 0 ? [] : days.slice(start);
  const counts = Object.fromEntries(PACKAGE_IDS.map((id) => [id, window.reduce((sum, day) => sum + day.purchases[id], 0)])) as Record<PackageId, number>;
  const other = window.reduce((sum, day) => sum + day.purchases.other, 0);
  const total = PACKAGE_IDS.reduce((sum, id) => sum + counts[id], 0);
  const usable = total >= MIN_PURCHASES;
  return {
    usable,
    problem: usable ? null : `För få köp än: ${total} köp av de tre paketen (minst ${MIN_PURCHASES} behövs).`,
    days: window.length,
    counts,
    other,
    total,
    perMonth: window.length > 0 ? ((total + other) * DAYS_PER_MONTH) / window.length : 0,
    shares: roundedShares(counts, total),
  };
}

// ── every box's starting text ──────────────────────────────────────────────────

export interface Defaults {
  /** every box's starting text: the examples, with the measured values laid over them when there are enough */
  fields: Fields;
  /** the boxes whose starting text is measured */
  measuredNames: ReadonlySet<string>;
  /** null when nothing was measured or it could not be read */
  estimate: MeasuredEstimate | null;
  /** null when the purchases could not be read */
  mix: PurchaseMix | null;
}

/** The text every box starts with: measured where there is enough measured, the example numbers elsewhere. */
export function defaultsFor(measured: MeasuredAcquisition | null, mix: PurchaseMix | null = null): Defaults {
  const estimate = measured ? estimateMonthly(measured) : null;
  const fromMeasurement: Fields = {};
  if (estimate?.usable) Object.assign(fromMeasurement, measuredFieldDefaults(estimate));
  if (mix?.usable) for (const id of PACKAGE_IDS) fromMeasurement[FIELD.mix(id)] = percentText(mix.shares[id]);
  const names = Object.keys(fromMeasurement);
  if (names.length === 0) return { fields: DEFAULT_FIELDS, measuredNames: new Set(), estimate, mix };
  return { fields: { ...DEFAULT_FIELDS, ...fromMeasurement }, measuredNames: new Set(names), estimate, mix };
}
