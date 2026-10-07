import { DEFAULT_LOCALE, type AppLocale } from "../locales";
import swedish from "./sv";
import type { DeepPartial, Messages } from "./types";

/**
 * WHERE EACH LANGUAGE'S TEXTS ARE LOADED FROM.
 *
 * One line per language in src/i18n/locales.ts. Swedish is the master copy and is always loaded, because
 * it is what everything falls back to; the other languages are loaded only when a visitor asks for them.
 * Adding a language: a line here, pointing at its folder (src/i18n/messages/de/index.ts).
 * TypeScript refuses to compile until every language on the list has a line here.
 */
const LOADERS: Record<AppLocale, () => Promise<{ default: DeepPartial<Messages> }>> = {
  sv: async () => ({ default: swedish }),
  en: () => import("./en"),
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** `base` with `over` laid on top, key by key: a text that `over` does not have stays as it is in `base`. */
export function overlay(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) continue;
    merged[key] = isPlainObject(value) && isPlainObject(base[key]) ? overlay(base[key] as Record<string, unknown>, value) : value;
  }
  return merged;
}

/** All the texts for a language: its own, with Swedish behind every one that is missing. */
export async function loadMessages(locale: AppLocale): Promise<Messages> {
  if (locale === DEFAULT_LOCALE) return swedish;
  const { default: own } = await LOADERS[locale]();
  return overlay(swedish as unknown as Record<string, unknown>, own as Record<string, unknown>) as unknown as Messages;
}

/** The texts of one language as written, with nothing filled in (used by the completeness check, npm run i18n:check). */
export async function loadOwnMessages(locale: AppLocale): Promise<DeepPartial<Messages>> {
  return (await LOADERS[locale]()).default;
}

/** Only some of the areas of the texts: what a page hands to its client components, so the browser is not sent the whole catalogue. */
export function pickMessages<K extends keyof Messages>(messages: Messages, areas: readonly K[]): Pick<Messages, K> {
  return Object.fromEntries(areas.map((area) => [area, messages[area]])) as Pick<Messages, K>;
}

/**
 * The areas whose texts are sent to the browser on EVERY page, because client components of the page frame
 * use them: the header (common, nav), the sign-in window (auth), the "how it works" window (onboarding),
 * the chat, the cookie banner. A page that has client components of its own hands over its areas too, with
 * <ClientMessages areas={[...]}> (src/i18n/ClientMessages.tsx).
 */
export const FRAME_AREAS = ["common", "nav", "auth", "chat", "consent", "onboarding"] as const;
