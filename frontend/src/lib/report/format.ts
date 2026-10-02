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
