/**
 * The numbers behind the admin portal's statistics page: types, and the pure
 * functions that turn database rows into days and days into a summary. No
 * database access and no browser APIs here, so the same code runs on the server
 * (when the page is built) and in the browser (when the range is changed), and
 * lib/admin/stats.verify.mjs can test it directly.
 */
import { DEVICE_TYPES, type DeviceType } from "@/lib/analytics/device";
import { stockholmDay } from "@/lib/analytics/day";
import { OMRADESANALYS_PRICE_SEK, TRE_BOSTADER_PRICE_SEK, TRYGGHETSPAKET_PRICE_SEK } from "@/lib/pricing";
import { getOneTimeProduct, isOneTimePriceKey } from "@/lib/stripe/prices";

export { DEVICE_TYPES, type DeviceType };

export const DEVICE_LABELS: Record<DeviceType, string> = { mobile: "Mobil", tablet: "Surfplatta", desktop: "Dator" };

export const PACKAGE_KEYS = ["omradesanalys", "trygghetspaket", "tre_bostader", "other"] as const;
export type PackageKey = (typeof PACKAGE_KEYS)[number];

/** What each package is called and costs. `other` is every older or unknown price key in the ledger. */
export const PACKAGES: Record<PackageKey, { label: string; priceSek: number | null }> = {
  omradesanalys: { label: getOneTimeProduct("omradesanalys").label, priceSek: OMRADESANALYS_PRICE_SEK },
  trygghetspaket: { label: getOneTimeProduct("trygghetspaket").label, priceSek: TRYGGHETSPAKET_PRICE_SEK },
  tre_bostader: { label: getOneTimeProduct("tre_bostader").label, priceSek: TRE_BOSTADER_PRICE_SEK },
  other: { label: "Äldre / övrigt", priceSek: null },
};

/** How many days of history the page is given; the longest range it can show twice (this period and the one before) is 90. */
export const HISTORY_DAYS = 180;
export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export interface DayStats {
  /** YYYY-MM-DD, Swedish calendar day */
  day: string;
  /** unique visitors that day, per device type */
  visitors: Record<DeviceType, number>;
  pageViews: Record<DeviceType, number>;
  /** purchases that day, per package */
  purchases: Record<PackageKey, number>;
}

export interface AdminStats {
  today: string;
  generatedAt: string;
  /** HISTORY_DAYS days ending today, oldest first, a day with nothing in it included as zeros */
  days: DayStats[];
  /** the first day anything was counted, or null while nothing has been */
  trackingSince: string | null;
  /** true for the development-only sample data (lib/admin/statsDemo.ts) */
  demo: boolean;
}

export type AdminStatsResult =
  | { status: "ok"; stats: AdminStats }
  | { status: "unconfigured" } // the database settings are missing (local development)
  | { status: "missing_tables" } // the analytics migration has not been applied
  | { status: "error"; message: string };

export interface DailyRow {
  day: string;
  device: string;
  visitors: number;
  page_views: number;
}

export interface PurchaseRow {
  price_key: string;
  created_at: string;
}

// ── dates ────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;

/** YYYY-MM-DD plus n days (n may be negative). Calendar arithmetic in UTC, so daylight-saving changes cannot skip or repeat a day. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** "6 okt". Spelled out here, not by Intl, so the server and the browser can never disagree. */
export function shortDate(day: string): string {
  return `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
}

// ── building the days ────────────────────────────────────────────────────────

const zeroDevices = (): Record<DeviceType, number> => ({ mobile: 0, tablet: 0, desktop: 0 });
const zeroPackages = (): Record<PackageKey, number> => ({ omradesanalys: 0, trygghetspaket: 0, tre_bostader: 0, other: 0 });

export function packageKeyOf(priceKey: string): PackageKey {
  return isOneTimePriceKey(priceKey) ? priceKey : "other";
}

const isDevice = (value: string): value is DeviceType => (DEVICE_TYPES as readonly string[]).includes(value);

/**
 * `span` consecutive days ending `today`, oldest first, with the counted visitors and page
 * views (analytics_daily) and the purchases (credit_purchases, by the Swedish day they were
 * made) filled in. Rows outside the window, or of an unknown device type, are ignored.
 */
export function buildDays(daily: DailyRow[], purchases: PurchaseRow[], today: string, span: number = HISTORY_DAYS): DayStats[] {
  const days = new Map<string, DayStats>();
  for (let i = span - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    days.set(day, { day, visitors: zeroDevices(), pageViews: zeroDevices(), purchases: zeroPackages() });
  }
  for (const row of daily) {
    const target = days.get(row.day);
    if (!target || !isDevice(row.device)) continue;
    target.visitors[row.device] += row.visitors;
    target.pageViews[row.device] += row.page_views;
  }
  for (const row of purchases) {
    const created = new Date(row.created_at);
    if (Number.isNaN(created.getTime())) continue;
    const target = days.get(stockholmDay(created));
    if (target) target.purchases[packageKeyOf(row.price_key)] += 1;
  }
  return [...days.values()];
}

// ── summing a range ──────────────────────────────────────────────────────────

export interface RangeSummary {
  days: number;
  /** the sum of each day's unique visitors: someone who comes back on three days counts three times */
  visitors: number;
  pageViews: number;
  visitorsByDevice: Record<DeviceType, number>;
  purchases: number;
  byPackage: Record<PackageKey, { count: number; revenueSek: number }>;
  /** purchases x today's list prices, before any discount code (the ledger holds no amounts) */
  revenueSek: number;
  /** null when there were no visitors to divide by */
  purchasesPer100Visitors: number | null;
}

export function summarize(days: DayStats[]): RangeSummary {
  const visitorsByDevice = zeroDevices();
  const byPackage: RangeSummary["byPackage"] = {
    omradesanalys: { count: 0, revenueSek: 0 },
    trygghetspaket: { count: 0, revenueSek: 0 },
    tre_bostader: { count: 0, revenueSek: 0 },
    other: { count: 0, revenueSek: 0 },
  };
  let pageViews = 0;
  for (const day of days) {
    for (const device of DEVICE_TYPES) {
      visitorsByDevice[device] += day.visitors[device];
      pageViews += day.pageViews[device];
    }
    for (const key of PACKAGE_KEYS) byPackage[key].count += day.purchases[key];
  }
  let revenueSek = 0;
  let purchases = 0;
  for (const key of PACKAGE_KEYS) {
    byPackage[key].revenueSek = byPackage[key].count * (PACKAGES[key].priceSek ?? 0);
    revenueSek += byPackage[key].revenueSek;
    purchases += byPackage[key].count;
  }
  const visitors = DEVICE_TYPES.reduce((sum, device) => sum + visitorsByDevice[device], 0);
  return {
    days: days.length,
    visitors,
    pageViews,
    visitorsByDevice,
    purchases,
    byPackage,
    revenueSek,
    purchasesPer100Visitors: visitors > 0 ? (purchases / visitors) * 100 : null,
  };
}

/** The last `range` days, or - with offset = range - the `range` days before those. */
export function windowOf(days: DayStats[], range: number, offset = 0): DayStats[] {
  const end = days.length - offset;
  return days.slice(Math.max(0, end - range), Math.max(0, end));
}

/** Change from `previous` to `current` as a fraction (0.12 = up 12 %); null when there is no earlier figure to compare with. */
export function change(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

// ── formatting (fixed, so server and browser print the same thing) ───────────

export const formatInt = (value: number) => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export const formatPercent = (fraction: number) => `${Math.round(fraction * 100)} %`;

/** One decimal, Swedish comma: 1,4 */
export const formatDecimal = (value: number) => value.toFixed(1).replace(".", ",");
