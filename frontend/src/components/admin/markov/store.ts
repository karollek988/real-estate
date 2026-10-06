/**
 * The simulator's settings, kept in this browser (localStorage) so they survive a reload:
 * the boxes as they are now, and - optionally - a saved "baseline" to compare against.
 * Nothing leaves the browser; the simulator has no server side.
 *
 * Written as an external store for React's useSyncExternalStore: the server (and the
 * browser's first pass over the server's HTML) see the example numbers, and the
 * browser then switches to what is saved, so there is no mismatch to hydrate over.
 */
import { DEFAULT_FIELDS, fieldsFromStored, serializeFields, type Fields } from "@/lib/markov/fields";

export interface MarkovSettings {
  fields: Fields;
  /** a saved set of boxes to compare the current ones with; null when none is saved */
  baseline: Fields | null;
}

const FIELDS_KEY = "kopanalys.markov.fields";
const BASELINE_KEY = "kopanalys.markov.baseline";

const SERVER_SETTINGS: MarkovSettings = { fields: DEFAULT_FIELDS, baseline: null };

let current: MarkovSettings | null = null;
const listeners = new Set<() => void>();

function load(): MarkovSettings {
  try {
    const fields = window.localStorage.getItem(FIELDS_KEY);
    const baseline = window.localStorage.getItem(BASELINE_KEY);
    return { fields: fields ? fieldsFromStored(fields) : DEFAULT_FIELDS, baseline: baseline ? fieldsFromStored(baseline) : null };
  } catch {
    // storage blocked or full: the simulator still works, it just won't remember
    return SERVER_SETTINGS;
  }
}

function save(settings: MarkovSettings) {
  try {
    window.localStorage.setItem(FIELDS_KEY, serializeFields(settings.fields));
    if (settings.baseline) window.localStorage.setItem(BASELINE_KEY, serializeFields(settings.baseline));
    else window.localStorage.removeItem(BASELINE_KEY);
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
    if (event.key !== null && event.key !== FIELDS_KEY && event.key !== BASELINE_KEY) return;
    current = load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setField(name: string, value: string) {
  const settings = getSettings();
  replace({ ...settings, fields: { ...settings.fields, [name]: value } });
}

export const resetFields = () => replace({ ...getSettings(), fields: DEFAULT_FIELDS });

/** Keeps the boxes as they are now as the thing to compare against. */
export const saveBaseline = () => {
  const settings = getSettings();
  replace({ ...settings, baseline: settings.fields });
};

export const clearBaseline = () => replace({ ...getSettings(), baseline: null });
