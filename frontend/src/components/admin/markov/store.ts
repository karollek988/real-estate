/**
 * The simulator's settings, kept in this browser (localStorage) so they survive a reload:
 *   - the boxes the person has typed in (as "overrides" over the starting values, see lib/markov/fields.ts),
 *   - optionally a saved "baseline" to compare against,
 *   - the named strategies (lib/markov/strategies.ts), and which one the boxes were last loaded from.
 * Nothing leaves the browser; the simulator has no server side. (The measured starting values come
 * from the server with the page, not from here.)
 *
 * Written as an external store for React's useSyncExternalStore: the server (and the
 * browser's first pass over the server's HTML) see no overrides, and the browser
 * then switches to what is saved, so there is no mismatch to hydrate over.
 */
import { fieldsFromStored, overridesFromStored, serializeFields, serializeOverrides, type Fields } from "@/lib/markov/fields";
import { MAX_STRATEGIES, cleanName, serializeStrategies, strategiesFromStored, type Strategy } from "@/lib/markov/strategies";

export interface MarkovSettings {
  /** the boxes typed in, by name; every other box shows its starting text */
  overrides: Fields;
  /** every box as it was when a baseline was saved; null when none is saved */
  baseline: Fields | null;
  /** the person's own strategies */
  strategies: Strategy[];
  /** the strategy (or preset) the boxes were last loaded from or saved as; null when none */
  activeId: string | null;
}

const FIELDS_KEY = "kopanalys.markov.fields";
const BASELINE_KEY = "kopanalys.markov.baseline";
const STRATEGIES_KEY = "kopanalys.markov.strategies";

const SERVER_SETTINGS: MarkovSettings = { overrides: {}, baseline: null, strategies: [], activeId: null };

let current: MarkovSettings | null = null;
const listeners = new Set<() => void>();

function load(): MarkovSettings {
  try {
    const overrides = window.localStorage.getItem(FIELDS_KEY);
    const baseline = window.localStorage.getItem(BASELINE_KEY);
    const strategies = strategiesFromStored(window.localStorage.getItem(STRATEGIES_KEY) ?? "");
    return { overrides: overrides ? overridesFromStored(overrides) : {}, baseline: baseline ? fieldsFromStored(baseline) : null, ...strategies };
  } catch {
    // storage blocked or full: the simulator still works, it just won't remember
    return SERVER_SETTINGS;
  }
}

function save(settings: MarkovSettings) {
  try {
    window.localStorage.setItem(FIELDS_KEY, serializeOverrides(settings.overrides));
    if (settings.baseline) window.localStorage.setItem(BASELINE_KEY, serializeFields(settings.baseline));
    else window.localStorage.removeItem(BASELINE_KEY);
    window.localStorage.setItem(STRATEGIES_KEY, serializeStrategies(settings.strategies, settings.activeId));
  } catch {
    // see load()
  }
}

function replace(next: MarkovSettings) {
  current = next;
  save(next);
  listeners.forEach((listener) => listener());
}

export const getSettings = (): MarkovSettings => (current ??= load());
export const getServerSettings = (): MarkovSettings => SERVER_SETTINGS;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  // another tab changed the settings
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== FIELDS_KEY && event.key !== BASELINE_KEY && event.key !== STRATEGIES_KEY) return;
    current = load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// ── the boxes ────────────────────────────────────────────────────────────────

/** The person typed `value` in the box `name`. */
export function setField(name: string, value: string) {
  const settings = getSettings();
  replace({ ...settings, overrides: { ...settings.overrides, [name]: value } });
}

/** The named boxes go back to their starting text (measured, where there is one). */
export function clearFields(names: readonly string[]) {
  const settings = getSettings();
  const overrides = { ...settings.overrides };
  let changed = false;
  for (const name of names) {
    if (name in overrides) {
      delete overrides[name];
      changed = true;
    }
  }
  if (changed) replace({ ...settings, overrides });
}

/** Every box back to its starting text. The strategy last loaded stays named: the boxes then show as changed from it. */
export const resetFields = () => replace({ ...getSettings(), overrides: {} });

// ── the baseline ─────────────────────────────────────────────────────────────

/** Keeps the boxes as they are now (`fields`: every box's text) as the thing to compare against. */
export const saveBaseline = (fields: Fields) => replace({ ...getSettings(), baseline: fields });

export const clearBaseline = () => replace({ ...getSettings(), baseline: null });

// ── strategies ───────────────────────────────────────────────────────────────

const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The boxes become `overrides` (a strategy's or a preset's), and `id` is the one they came from. */
export const loadStrategy = (overrides: Fields, id: string) => replace({ ...getSettings(), overrides: { ...overrides }, activeId: id });

/** Keeps `overrides` under a new name; the boxes then count as that strategy. Returns its id, or null when the name is empty or there are too many. */
export function saveStrategy(name: string, overrides: Fields): string | null {
  const settings = getSettings();
  const clean = cleanName(name);
  if (!clean || settings.strategies.length >= MAX_STRATEGIES) return null;
  const id = newId();
  replace({ ...settings, strategies: [...settings.strategies, { id, name: clean, overrides: { ...overrides } }], activeId: id });
  return id;
}

/** The strategy `id` now holds `overrides`; it becomes the one the boxes count as. */
export function updateStrategy(id: string, overrides: Fields) {
  const settings = getSettings();
  replace({ ...settings, strategies: settings.strategies.map((s) => (s.id === id ? { ...s, overrides: { ...overrides } } : s)), activeId: id });
}

export function renameStrategy(id: string, name: string) {
  const settings = getSettings();
  const clean = cleanName(name);
  if (!clean) return;
  replace({ ...settings, strategies: settings.strategies.map((s) => (s.id === id ? { ...s, name: clean } : s)) });
}

export function deleteStrategy(id: string) {
  const settings = getSettings();
  replace({ ...settings, strategies: settings.strategies.filter((s) => s.id !== id), activeId: settings.activeId === id ? null : settings.activeId });
}
