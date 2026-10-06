/**
 * What is typed into the simulator's boxes, and how it becomes numbers.
 *
 * The page keeps every box as the text the person typed ("0,5", "12.5", ""), not as a
 * number: a number input that is re-printed on every key press eats a half-typed "2,"
 * and fights the cursor. Here the text is read, checked, and turned into MarkovParams;
 * a box that can't be read is reported and the simulation waits for it.
 */
import { DEFAULT_PARAMS, EDGES, MONTH_CHOICES, ROW_TOLERANCE, TRACKED_IDS, edgeKey, leaveProbability, type EdgeKey, type MarkovParams, type TrackedId } from "./model";

export type Fields = Record<string, string>;

export const FIELD = {
  newVisitors: "newVisitors",
  months: "months",
  edge: (key: EdgeKey) => `edge:${key}`,
  initial: (id: TrackedId) => `initial:${id}`,
  /** where a row's "adds up to more than 100 %" error is kept */
  row: (id: TrackedId) => `row:${id}`,
} as const;

// ── numbers as text ──────────────────────────────────────────────────────────

/** 0.005 -> "0,5": a chance as the percentage a Swede would write. */
export const percentText = (fraction: number) => String(Math.round(fraction * 10_000) / 100).replace(".", ",");

const numberText = (value: number) => String(value).replace(".", ",");

/** Reads "12,5", "12.5", " 12 % ". Null if it isn't a plain number. */
export function readNumber(text: string): number | null {
  const cleaned = text.replace(/\s|%| /g, "").replace(",", ".");
  if (cleaned === "" || !/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

// ── params <-> fields ────────────────────────────────────────────────────────

export function fieldsFromParams(params: MarkovParams): Fields {
  const fields: Fields = { [FIELD.newVisitors]: numberText(params.newVisitors), [FIELD.months]: String(params.months) };
  for (const edge of EDGES) fields[FIELD.edge(edgeKey(edge.from, edge.to))] = percentText(params.transitions[edgeKey(edge.from, edge.to)] ?? 0);
  for (const id of TRACKED_IDS) fields[FIELD.initial(id)] = numberText(params.initial[id]);
  return fields;
}

export const DEFAULT_FIELDS: Fields = fieldsFromParams(DEFAULT_PARAMS);

const MAX_COUNT = 1_000_000_000;

export interface ParsedFields {
  params: MarkovParams;
  /** field name -> what is wrong; a row's total is under FIELD.row(state). Empty when everything can be run. */
  errors: Record<string, string>;
}

export function parseFields(fields: Fields): ParsedFields {
  const errors: Record<string, string> = {};
  const text = (name: string) => fields[name] ?? DEFAULT_FIELDS[name] ?? "";

  const count = (name: string): number => {
    const value = readNumber(text(name));
    if (value === null || value > MAX_COUNT) {
      errors[name] = "Ange ett tal, 0 eller mer";
      return 0;
    }
    return value;
  };

  const monthsValue = readNumber(text(FIELD.months));
  const months = monthsValue !== null && (MONTH_CHOICES as readonly number[]).includes(monthsValue) ? monthsValue : DEFAULT_PARAMS.months;

  const transitions: MarkovParams["transitions"] = {};
  for (const edge of EDGES) {
    const key = edgeKey(edge.from, edge.to);
    const name = FIELD.edge(key);
    const percent = readNumber(text(name));
    if (percent === null || percent > 100) {
      errors[name] = "Ange en procent mellan 0 och 100";
      transitions[key] = 0;
    } else {
      transitions[key] = percent / 100;
    }
  }

  const initial = {} as MarkovParams["initial"];
  for (const id of TRACKED_IDS) initial[id] = count(FIELD.initial(id));

  const params: MarkovParams = { newVisitors: count(FIELD.newVisitors), initial, transitions, months };

  for (const id of TRACKED_IDS) {
    if (leaveProbability(transitions, id) > 1 + ROW_TOLERANCE) errors[FIELD.row(id)] = "Övergångarna blir tillsammans mer än 100 %";
  }
  return { params, errors };
}

// ── saved settings ───────────────────────────────────────────────────────────

const STORAGE_VERSION = 1;

export const serializeFields = (fields: Fields) => JSON.stringify({ v: STORAGE_VERSION, fields });

/** The saved text, laid over the defaults: unknown or malformed entries are ignored, never trusted. */
export function fieldsFromStored(raw: string): Fields {
  if (!raw) return DEFAULT_FIELDS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || (parsed as { v?: unknown }).v !== STORAGE_VERSION) return DEFAULT_FIELDS;
    const saved = (parsed as { fields?: unknown }).fields;
    if (typeof saved !== "object" || saved === null) return DEFAULT_FIELDS;
    const merged: Fields = { ...DEFAULT_FIELDS };
    for (const name of Object.keys(DEFAULT_FIELDS)) {
      const value = (saved as Record<string, unknown>)[name];
      if (typeof value === "string" && value.length <= 24) merged[name] = value;
    }
    return merged;
  } catch {
    return DEFAULT_FIELDS;
  }
}

/** True when two boxes say the same thing: "12", "12,0" and "12 %" are the same number. */
export function sameField(name: string, a: Fields, b: Fields): boolean {
  const left = a[name] ?? "";
  const right = b[name] ?? "";
  const x = readNumber(left);
  const y = readNumber(right);
  return x !== null && y !== null ? Math.abs(x - y) < 1e-9 : left.trim() === right.trim();
}

/** True when two sets of boxes say the same thing. */
export const sameFields = (a: Fields, b: Fields) => Object.keys(DEFAULT_FIELDS).every((name) => sameField(name, a, b));
