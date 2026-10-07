/**
 * Marketing strategies: a name for a set of typed-in boxes (the "overrides" over the starting values), kept in
 * this browser, to load back, change, and compare side by side. A strategy is only the boxes that differ from the
 * starting values, so one saved from "measured today" keeps following new measurements wherever it did not
 * change a box. Plain data and functions, no React and no storage: the page keeps them (components/admin/markov/store.ts).
 */
import { effectiveFields, sameFields, sanitizeOverrides, type Fields } from "./fields";

export interface Strategy {
  id: string;
  name: string;
  overrides: Fields;
}

/** A strategy that comes with the page: it can be loaded and compared, not changed or deleted. */
export interface Preset {
  id: string;
  name: string;
  description: string;
  overrides: Fields;
}

export const MAX_STRATEGIES = 12;
export const MAX_NAME_LENGTH = 40;
/** How many strategies the comparison shows side by side. */
export const MAX_COMPARED = 4;
/** The comparison also takes "what the boxes say right now" under this id. */
export const WORKING_ID = "working";

export const PRESETS: readonly Preset[] = [
  { id: "preset:today", name: "Nuläge", description: "Allt som uppmätt (eller exempelvärden): trafiken ligger kvar som nu.", overrides: {} },
  { id: "preset:seo", name: "Mer SEO", description: "Trafiken från sökmotorer växer 6 % i månaden.", overrides: { "channel:seo:growth": "6" } },
  { id: "preset:ads", name: "Annonser på", description: "20 000 kr i annonser varje månad, från månad 1.", overrides: { "channel:ads:budget": "20000" } },
  { id: "preset:ai", name: "AI-synlighet", description: "Trafiken från AI-sökmotorer växer 15 % i månaden.", overrides: { "channel:ai:growth": "15" } },
  {
    id: "preset:all",
    name: "Allt på en gång",
    description: "Sökmotorer 6 %, AI-sökmotorer 15 % och 20 000 kr i annonser.",
    overrides: { "channel:seo:growth": "6", "channel:ai:growth": "15", "channel:ads:budget": "20000" },
  },
];

export const findPreset = (id: string | null) => PRESETS.find((preset) => preset.id === id) ?? null;

/** A name as it is kept: trimmed, single-spaced, at most MAX_NAME_LENGTH characters. Empty when there is nothing left. */
export const cleanName = (raw: string): string => raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH).trim();

const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

/** Saved strategies, from storage or anywhere else not trusted: anything malformed is left out, never fixed up. */
export function sanitizeStrategies(raw: unknown): Strategy[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const kept: Strategy[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { id, name, overrides } = item as { id?: unknown; name?: unknown; overrides?: unknown };
    if (typeof id !== "string" || !ID_PATTERN.test(id) || seen.has(id) || typeof name !== "string") continue;
    const clean = cleanName(name);
    if (!clean) continue;
    seen.add(id);
    kept.push({ id, name: clean, overrides: sanitizeOverrides(overrides) });
    if (kept.length >= MAX_STRATEGIES) break;
  }
  return kept;
}

export const STRATEGIES_VERSION = 1;

export const serializeStrategies = (strategies: Strategy[], activeId: string | null) => JSON.stringify({ v: STRATEGIES_VERSION, strategies, activeId });

/** What was saved: the strategies, and which one the boxes were last loaded from (only if it still exists). */
export function strategiesFromStored(raw: string): { strategies: Strategy[]; activeId: string | null } {
  const none = { strategies: [], activeId: null };
  if (!raw) return none;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || (parsed as { v?: unknown }).v !== STRATEGIES_VERSION) return none;
    const strategies = sanitizeStrategies((parsed as { strategies?: unknown }).strategies);
    const active = (parsed as { activeId?: unknown }).activeId;
    const activeId = typeof active === "string" && (strategies.some((s) => s.id === active) || findPreset(active)) ? active : null;
    return { strategies, activeId };
  } catch {
    return none;
  }
}

/** True when two sets of typed-in boxes give the same text in every box (a box typed to its starting text is the same as untouched). */
export const sameStrategy = (defaults: Fields, a: Fields, b: Fields) => sameFields(effectiveFields(defaults, a), effectiveFields(defaults, b));

/** Every box's text for a strategy in a comparison: the starting text, the strategy's boxes, and the same number of months for all. */
export const fieldsForComparison = (defaults: Fields, overrides: Fields, months: string): Fields => ({ ...effectiveFields(defaults, overrides), months });
