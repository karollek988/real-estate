import { DEFAULT_LOCALE, type AppLocale } from "@/i18n/locales";
import { callEngine } from "./engine";
import { findTranslations, hashText, saveTranslations, type NewTranslation } from "./store";

/**
 * Translates texts for the pages: `translateTexts(["Hej"], "en")` gives ["Hello"]. Server-only.
 *
 *   - What has been translated before comes from the cache (store.ts); only the rest is sent to the translator
 *     (engine.ts), in slices, and each slice is remembered as soon as it is back.
 *   - A text that could not be translated (the translator is down, the language has no model, the time ran
 *     out) comes back as null: the caller shows the original. The same text is tried again next time.
 *   - `budgetMs` is for a page that is being built: no new slice is started after that time, so a long article
 *     never makes the page time out. What was translated in the time is kept, and the rest follows on the next
 *     rebuild (the editor's save translates all of it in the background, see content.ts).
 *   - Texts in the same process are translated one slice at a time (the translator uses every core anyway).
 */

export interface TranslateOptions {
  /** The language the texts are written in (default: the site's own, Swedish). */
  from?: AppLocale;
  /** Stop starting new slices after this many milliseconds. */
  budgetMs?: number;
}

const SLICE_CHARS = 3500;
const SLICE_TEXTS = 40;

let queue: Promise<unknown> = Promise.resolve();

/** Runs one job at a time, in the order asked for. */
function inTurn<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

export async function translateTexts(texts: string[], target: AppLocale, options: TranslateOptions = {}): Promise<(string | null)[]> {
  const from = options.from ?? DEFAULT_LOCALE;
  if (target === from) return texts.slice();

  const started = Date.now();
  const results: (string | null)[] = texts.map((text) => (text.trim() === "" ? text : null));

  // the distinct texts that need a translation, by fingerprint
  const wanted = new Map<string, string>();
  texts.forEach((text, i) => {
    if (results[i] === null) wanted.set(hashText(from, text), text);
  });
  if (wanted.size === 0) return results;

  const translated = new Map<string, string>(await findTranslations([...wanted.keys()], target));

  const missing = [...wanted].filter(([hash]) => !translated.has(hash));
  if (missing.length > 0) {
    await inTurn(async () => {
      // somebody may have translated some of them while we waited for our turn
      const again = await findTranslations(
        missing.map(([hash]) => hash),
        target,
      );
      again.forEach((value, hash) => translated.set(hash, value));
      const todo = missing.filter(([hash]) => !translated.has(hash));

      for (let i = 0; i < todo.length; ) {
        if (options.budgetMs !== undefined && Date.now() - started > options.budgetMs) return;
        // the next slice: as many texts as fit, at least one
        let end = i;
        let chars = 0;
        while (end < todo.length && end - i < SLICE_TEXTS && (end === i || chars + todo[end][1].length <= SLICE_CHARS)) {
          chars += todo[end][1].length;
          end++;
        }
        const slice = todo.slice(i, end);
        const answer = await callEngine(
          slice.map(([, text]) => text),
          from,
          target,
        );
        if (!answer) return; // the translator is not there: the rest stays untranslated, nothing more is tried now
        const fresh: NewTranslation[] = slice.map(([hash, text], j) => ({
          hash,
          source: from,
          sourceText: text,
          target,
          translated: answer.translations[j],
          engine: answer.engine,
        }));
        await saveTranslations(fresh);
        fresh.forEach((row) => translated.set(row.hash, row.translated));
        i = end;
      }
    });
  }

  return texts.map((text, i) => results[i] ?? translated.get(hashText(from, text)) ?? null);
}

/** One text; null when it could not be translated. */
export async function translateText(text: string, target: AppLocale, options?: TranslateOptions): Promise<string | null> {
  return (await translateTexts([text], target, options))[0];
}
