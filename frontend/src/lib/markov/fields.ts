/**
 * What is typed into the simulator's boxes, and how it becomes numbers.
 *
 * The page keeps every box as the text the person typed ("0,5", "12.5", ""), not as a
 * number: a number input that is re-printed on every key press eats a half-typed "2,"
 * and fights the cursor. Here the text is read, checked, and turned into MarkovParams;
 * a box that can't be read is reported and the simulation waits for it.
 *
 * Only the boxes that are in use are checked: with the visitors typed by hand the channel boxes
 * are left alone, and with channels the "new visitors per month" box is.
 */
import { CHANNEL_IDS, DEFAULT_ACQUISITION, MAX_GROWTH, MAX_MONTHS, MAX_QUALITY, MIN_GROWTH, type Acquisition, type ChannelId } from "./acquisition";
import { PACKAGE_IDS, type Finance, type PackageId } from "./finance";
import { DEFAULT_PARAMS, EDGES, MONTH_CHOICES, ROW_TOLERANCE, TRACKED_IDS, edgeKey, leaveProbability, type EdgeKey, type MarkovParams, type TrackedId } from "./model";

export type Fields = Record<string, string>;

/** The boxes of a channel. Which a channel has depends on its kind (see CHANNEL_PROPS). */
export type ChannelProp = "start" | "growth" | "cap" | "quality" | "budget" | "cpv" | "doubling" | "from" | "to" | "visitors";

/** The boxes of each channel, in the order they are shown. */
export const CHANNEL_PROPS: Record<ChannelId, readonly ChannelProp[]> = {
  seo: ["start", "growth", "cap", "quality"],
  ads: ["budget", "cpv", "doubling", "from", "to", "quality"],
  social: ["start", "growth", "cap", "quality"],
  ai: ["start", "growth", "cap", "quality"],
  direct: ["visitors", "quality"],
};

/** The name of a box's number in Acquisition. */
const PROP_KEY: Record<ChannelProp, string> = {
  start: "start",
  growth: "growth",
  cap: "cap",
  quality: "quality",
  budget: "budget",
  cpv: "costPerVisitor",
  doubling: "doublingSpend",
  from: "from",
  to: "to",
  visitors: "visitors",
};

export const FIELD = {
  newVisitors: "newVisitors",
  months: "months",
  /** "manual" or "channels" */
  source: "source",
  edge: (key: EdgeKey) => `edge:${key}`,
  initial: (id: TrackedId) => `initial:${id}`,
  channel: (id: ChannelId, prop: ChannelProp) => `channel:${id}:${prop}`,
  /** what a package costs the buyer, including VAT, and the share of purchases that is that package */
  price: (id: PackageId) => `revenue:price:${id}`,
  mix: (id: PackageId) => `revenue:mix:${id}`,
  vat: "revenue:vat",
  feePercent: "revenue:feePercent",
  feeFixed: "revenue:feeFixed",
  fixedCosts: "costs:fixed",
  /** where "the shares of the packages do not add up to 100 %" is kept */
  mixRow: "row:mix",
  /** where a row's "adds up to more than 100 %" error is kept */
  row: (id: TrackedId) => `row:${id}`,
} as const;

// ── numbers as text ──────────────────────────────────────────────────────────

/** 0.005 -> "0,5": a chance as the percentage a Swede would write. */
export const percentText = (fraction: number) => String(Math.round(fraction * 10_000) / 100).replace(".", ",");

const numberText = (value: number) => String(value).replace(".", ",");

/** Reads "12,5", "12.5", " 12 % ". Null if it isn't a plain number. */
export function readNumber(text: string): number | null {
  const cleaned = text.replace(/\s|%| /g, "").replace(",", ".");
  if (cleaned === "" || !/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Like readNumber, but a leading minus (or the typographic one) is allowed: "-3,5". */
export function readSigned(text: string): number | null {
  const trimmed = text.trim().replace(/^[−–]/, "-");
  if (trimmed.startsWith("-")) {
    const value = readNumber(trimmed.slice(1));
    return value === null ? null : value === 0 ? 0 : -value;
  }
  return readNumber(trimmed.replace(/^\+/, ""));
}

// ── params <-> fields ────────────────────────────────────────────────────────

function channelText(acquisition: Acquisition, id: ChannelId, prop: ChannelProp): string {
  const value = (acquisition[id] as unknown as Record<string, number>)[PROP_KEY[prop]];
  return prop === "growth" ? percentText(value) : numberText(value);
}

export function fieldsFromParams(params: MarkovParams): Fields {
  const fields: Fields = { [FIELD.newVisitors]: numberText(params.newVisitors), [FIELD.months]: String(params.months), [FIELD.source]: params.acquisition.mode };
  for (const edge of EDGES) fields[FIELD.edge(edgeKey(edge.from, edge.to))] = percentText(params.transitions[edgeKey(edge.from, edge.to)] ?? 0);
  for (const id of TRACKED_IDS) fields[FIELD.initial(id)] = numberText(params.initial[id]);
  for (const id of CHANNEL_IDS) for (const prop of CHANNEL_PROPS[id]) fields[FIELD.channel(id, prop)] = channelText(params.acquisition, id, prop);
  for (const id of PACKAGE_IDS) {
    fields[FIELD.price(id)] = numberText(params.finance.prices[id]);
    fields[FIELD.mix(id)] = percentText(params.finance.mix[id]);
  }
  fields[FIELD.vat] = percentText(params.finance.vat);
  fields[FIELD.feePercent] = percentText(params.finance.feePercent);
  fields[FIELD.feeFixed] = numberText(params.finance.feeFixed);
  fields[FIELD.fixedCosts] = numberText(params.finance.fixedMonthly);
  return fields;
}

export const DEFAULT_FIELDS: Fields = fieldsFromParams(DEFAULT_PARAMS);

const MAX_COUNT = 1_000_000_000;

/** What a channel box must be, and what to say when it is not. `scale` turns what is typed into what is stored (percent -> fraction). */
interface Rule {
  message: string;
  signed?: boolean;
  scale?: number;
  ok: (value: number) => boolean;
}

const COUNT: Rule = { message: "Ange ett tal, 0 eller mer", ok: (v) => v >= 0 && v <= MAX_COUNT };
const POSITIVE: Rule = { message: "Ange ett tal större än 0", ok: (v) => v > 0 && v <= MAX_COUNT };

const RULES: Record<ChannelProp, Rule> = {
  start: COUNT,
  cap: COUNT,
  budget: COUNT,
  visitors: COUNT,
  cpv: POSITIVE,
  doubling: POSITIVE,
  growth: { message: `Ange en procent mellan −${-MIN_GROWTH * 100} och ${MAX_GROWTH * 100}`, signed: true, scale: 0.01, ok: (v) => v >= MIN_GROWTH * 100 && v <= MAX_GROWTH * 100 },
  quality: { message: `Ange ett tal mellan 0 och ${MAX_QUALITY}`, ok: (v) => v >= 0 && v <= MAX_QUALITY },
  from: { message: `Ange en månad mellan 1 och ${MAX_MONTHS}`, ok: (v) => Number.isInteger(v) && v >= 1 && v <= MAX_MONTHS },
  to: { message: `Ange en månad mellan 1 och ${MAX_MONTHS}`, ok: (v) => Number.isInteger(v) && v >= 1 && v <= MAX_MONTHS },
};

export interface ParsedFields {
  params: MarkovParams;
  /** field name -> what is wrong; a row's total is under FIELD.row(state). Empty when everything can be run. */
  errors: Record<string, string>;
}

/** The money boxes: always in use, so always checked. A bad box is reported and counts as the example number. */
function parseFinance(text: (name: string) => string, errors: Record<string, string>): Finance {
  const example = DEFAULT_PARAMS.finance;
  const read = (name: string, fallback: number, ok: (value: number) => boolean, message: string, divisor = 1): number => {
    const typed = readNumber(text(name));
    if (typed !== null && ok(typed)) return typed / divisor;
    errors[name] = message;
    return fallback;
  };
  const amount = (name: string, fallback: number) => read(name, fallback, (v) => v >= 0 && v <= MAX_COUNT, "Ange ett belopp i kronor, 0 eller mer");
  const percent = (name: string, fallback: number, max: number) => read(name, fallback, (v) => v >= 0 && v <= max, `Ange en procent mellan 0 och ${max}`, 100);

  const prices = {} as Finance["prices"];
  const mix = {} as Finance["mix"];
  for (const id of PACKAGE_IDS) {
    prices[id] = amount(FIELD.price(id), example.prices[id]);
    mix[id] = percent(FIELD.mix(id), example.mix[id], 100);
  }
  const total = PACKAGE_IDS.reduce((sum, id) => sum + mix[id], 0);
  if (!PACKAGE_IDS.some((id) => FIELD.mix(id) in errors) && Math.abs(total - 1) > MIX_TOLERANCE) {
    errors[FIELD.mixRow] = `Andelarna måste bli 100 % tillsammans (de blir ${percentText(total)} %)`;
  }
  return {
    prices,
    mix,
    vat: percent(FIELD.vat, example.vat, 60),
    feePercent: percent(FIELD.feePercent, example.feePercent, 20),
    feeFixed: read(FIELD.feeFixed, example.feeFixed, (v) => v >= 0 && v <= 100, "Ange ett belopp mellan 0 och 100 kr"),
    fixedMonthly: amount(FIELD.fixedCosts, example.fixedMonthly),
  };
}

/** The shares of the packages may be off from 100 % by this much (a rounded measurement adds up to 99,9 or 100,1). */
const MIX_TOLERANCE = 0.0006;

export function parseFields(fields: Fields): ParsedFields {
  const errors: Record<string, string> = {};
  const text = (name: string) => fields[name] ?? DEFAULT_FIELDS[name] ?? "";

  const count = (name: string): number => {
    const value = readNumber(text(name));
    if (value === null || value > MAX_COUNT) {
      errors[name] = COUNT.message;
      return 0;
    }
    return value;
  };

  const monthsValue = readNumber(text(FIELD.months));
  const months = monthsValue !== null && (MONTH_CHOICES as readonly number[]).includes(monthsValue) ? monthsValue : DEFAULT_PARAMS.months;

  const mode: Acquisition["mode"] = text(FIELD.source) === "manual" ? "manual" : "channels";
  const channelsInUse = mode === "channels";

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

  // the boxes that are not in use are read if they can be, and never complained about
  const newVisitors = channelsInUse ? (readNumber(text(FIELD.newVisitors)) ?? DEFAULT_PARAMS.newVisitors) : count(FIELD.newVisitors);

  const channels = {} as Record<ChannelId, Record<string, number>>;
  for (const id of CHANNEL_IDS) {
    channels[id] = {};
    for (const prop of CHANNEL_PROPS[id]) {
      const name = FIELD.channel(id, prop);
      const rule = RULES[prop];
      const typed = rule.signed ? readSigned(text(name)) : readNumber(text(name));
      const fallback = (DEFAULT_ACQUISITION[id] as unknown as Record<string, number>)[PROP_KEY[prop]];
      if (typed !== null && rule.ok(typed)) {
        channels[id][PROP_KEY[prop]] = typed * (rule.scale ?? 1);
      } else {
        if (channelsInUse) errors[name] = rule.message;
        channels[id][PROP_KEY[prop]] = fallback;
      }
    }
  }
  if (channelsInUse) {
    // two boxes that only make sense together
    for (const id of CHANNEL_IDS) {
      const c = channels[id];
      if (c.cap !== undefined && c.start !== undefined && c.cap < c.start && !errors[FIELD.channel(id, "cap")]) errors[FIELD.channel(id, "cap")] = "Taket får inte vara lägre än startvärdet";
      if (c.to !== undefined && c.from !== undefined && c.to < c.from && !errors[FIELD.channel(id, "to")]) errors[FIELD.channel(id, "to")] = "Sista månaden kan inte vara före den första";
    }
  }

  const finance = parseFinance(text, errors);
  const params: MarkovParams = { newVisitors, acquisition: { mode, ...channels } as unknown as Acquisition, finance, initial, transitions, months };

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

// A box the person has not touched shows its starting text (the measured value, where there is one, else
// the example), and follows it when it changes. What is saved for the working boxes is therefore only the
// ones they have typed in: the "overrides".

const OVERRIDES_VERSION = 2;

export const serializeOverrides = (overrides: Fields) => JSON.stringify({ v: OVERRIDES_VERSION, overrides });

const keepKnown = (saved: unknown, accept: (name: string, value: string) => boolean): Fields => {
  const kept: Fields = {};
  if (typeof saved !== "object" || saved === null) return kept;
  for (const name of Object.keys(DEFAULT_FIELDS)) {
    const value = (saved as Record<string, unknown>)[name];
    if (typeof value === "string" && value.length <= 24 && accept(name, value)) kept[name] = value;
  }
  return kept;
};

/**
 * The typed-in boxes from what was saved. Version 2 is saved as it is. Version 1 (before there were measured
 * starting values) saved every box in full: what differs from the example numbers is what the person had typed.
 */
export function overridesFromStored(raw: string): Fields {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const { v, overrides, fields } = parsed as { v?: unknown; overrides?: unknown; fields?: unknown };
    if (v === OVERRIDES_VERSION) return keepKnown(overrides, () => true);
    if (v === 1) return keepKnown(fields, (name, value) => value.trim() !== DEFAULT_FIELDS[name].trim());
    return {};
  } catch {
    return {};
  }
}

/** A saved set of typed-in boxes, with anything that is not a known box or not short text left out. */
export const sanitizeOverrides = (saved: unknown): Fields => keepKnown(saved, () => true);

/** Every box's text: the starting text, with the typed-in boxes laid over it. */
export const effectiveFields = (defaults: Fields, overrides: Fields): Fields => ({ ...defaults, ...overrides });

/** True when two boxes say the same thing: "12", "12,0" and "12 %" are the same number. */
export function sameField(name: string, a: Fields, b: Fields): boolean {
  const left = a[name] ?? "";
  const right = b[name] ?? "";
  const x = readSigned(left);
  const y = readSigned(right);
  return x !== null && y !== null ? Math.abs(x - y) < 1e-9 : left.trim() === right.trim();
}

/** True when two sets of boxes say the same thing. */
export const sameFields = (a: Fields, b: Fields) => Object.keys(DEFAULT_FIELDS).every((name) => sameField(name, a, b));
