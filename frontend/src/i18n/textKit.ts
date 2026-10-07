import { createTranslator } from "use-intl/core";
import { LOCALES, type AppLocale } from "./locales";
import type { Translator } from "./translator";
// Runtime imports in this file are relative, not "@/..." - the verify scripts run the report code directly with
// tsx, which does not resolve the "@/" path alias.

/**
 * Everything a piece of code needs to write texts for one reader: which language, the tag that tells `Intl`
 * how to write numbers and dates in it, and a translator. The translator is "root": a key is written in full,
 * `t("report.summary.intro")`, so one kit serves every area of the messages.
 *
 * The report builders (lib/report, lib/brf) take a kit, so they work the same on the server (the report page,
 * the PDF, the API), in the browser (the example report on the start page) and in a plain script (the verify
 * scripts, the Swedish-only review console).
 */
export interface TextKit {
  locale: AppLocale;
  /** The tag for Intl: "sv-SE", "en-GB". */
  formatLocale: string;
  t: Translator;
}

/** A kit for `locale` from messages already at hand (all of them, or only the areas the code uses). */
export function makeTextKit(locale: AppLocale, messages: object): TextKit {
  return {
    locale,
    formatLocale: LOCALES[locale].formatLocale,
    // Typed keys do not help in a function that is handed the messages of any language: checked at the call sites instead.
    t: createTranslator({ locale, messages } as never) as unknown as Translator,
  };
}

/** A Swedish kit from the Swedish messages of just the areas needed: for the Swedish-only review console and the verify scripts. */
export function swedishTextKit(messages: object): TextKit {
  return makeTextKit("sv", messages);
}
