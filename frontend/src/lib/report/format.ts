/**
 * Formatting helpers shared by the report's chapter builders (build.ts,
 * housingCost.ts, questions.ts) so the same fact never renders differently in
 * different chapters. Pure functions, no imports.
 */

export const NA = "Uppgift saknas";

export function sek(value: number | null | undefined): string {
  if (value === null || value === undefined) return NA;
  return new Intl.NumberFormat("sv-SE").format(Math.round(value)) + " kr";
}

export function sekPerM2(value: number | null | undefined): string {
  if (value === null || value === undefined) return NA;
  return new Intl.NumberFormat("sv-SE").format(Math.round(value)) + " kr/m²";
}

export function pct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return NA;
  const sign = value > 0 ? "+" : "";
  return `${sign}${decSv(value, decimals)} %`;
}

/** A number with a Swedish decimal comma: decSv(2.25, 2) -> "2,25", decSv(80.1, 1) -> "80,1". */
export function decSv(value: number, decimals = 1): string {
  return value.toFixed(decimals).replace(".", ",");
}

/** A rate as Swedish text without trailing zeros: 2.25 -> "2,25 %", 2 -> "2 %". */
export function ratePctSv(value: number): string {
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 }).format(value)} %`;
}

/** Shared date formatting so the same fact (e.g. a previous sale date) never
 *  renders differently in different chapters. */
export function dateSv(value: string | null | undefined): string {
  if (!value) return NA;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" });
}

export function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function listSv(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} och ${items[items.length - 1]}`;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  The same helpers for any language                                      */
/*                                                                        */
/*  The functions above write Swedish and stay for code that is Swedish    */
/*  only (the cost rules, the review console). The report in every        */
/*  language is written with createFormat(kit), which gives the same       */
/*  results in Swedish (checked by build.verify.mjs) and writes numbers,   */
/*  dates, currency and lists the way each language does.                  */
/* ────────────────────────────────────────────────────────────────────── */

import type { TextKit } from "../../i18n/textKit";

export interface Format {
  /** The text for a value that is not known ("Uppgift saknas"). */
  na: string;
  sek(value: number | null | undefined): string;
  sekPerM2(value: number | null | undefined): string;
  /** A percentage with a sign for increases: "+1,5 %". */
  pct(value: number | null | undefined, decimals?: number): string;
  /** A number with a fixed number of decimals and the language's decimal mark, no grouping: 2.25 -> "2,25". */
  dec(value: number, decimals?: number): string;
  /** A rate without trailing zeros: 2.25 -> "2,25 %", 2 -> "2 %". */
  ratePct(value: number): string;
  date(value: string | null | undefined): string;
  list(items: string[]): string;
  /** A distance in metres: under a kilometre as "850 m", else "1,2 km". */
  distance(metres: number): string;
  /** A whole number grouped the way the language groups digits. */
  int(value: number): string;
  /** A decimal-mark-aware number written without a unit, used to fill {value} in a message. */
  decimalSeparator: string;
}

export function createFormat(kit: TextKit): Format {
  const { t, formatLocale } = kit;
  const na = t("report.format.na") as string;
  const decimalSeparator = new Intl.NumberFormat(formatLocale).formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";
  const dec = (value: number, decimals = 1) => value.toFixed(decimals).replace(".", decimalSeparator);
  const int = (value: number) => new Intl.NumberFormat(formatLocale).format(value);
  return {
    na,
    decimalSeparator,
    dec,
    int,
    sek: (value) => (value === null || value === undefined ? na : t("report.format.sek", { value: int(Math.round(value)) })),
    sekPerM2: (value) => (value === null || value === undefined ? na : t("report.format.sekPerM2", { value: int(Math.round(value)) })),
    pct: (value, decimals = 1) => {
      if (value === null || value === undefined) return na;
      const sign = value > 0 ? "+" : "";
      return t("report.format.percent", { value: `${sign}${dec(value, decimals)}` });
    },
    ratePct: (value) => t("report.format.percent", { value: new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 2 }).format(value) }),
    date: (value) => {
      if (!value) return na;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(formatLocale, { year: "numeric", month: "long", day: "numeric" });
    },
    list: (items) => (items.length === 0 ? "" : new Intl.ListFormat(formatLocale, { style: "long", type: "conjunction" }).format(items)),
    distance: (metres) =>
      metres < 1000
        ? t("report.format.meters", { value: String(Math.round(metres)) })
        : t("report.format.kilometers", { value: dec(metres / 1000, 1) }),
  };
}
