import { loadMessages } from "./messages";
import type { AppLocale } from "./locales";
import { makeTextKit, type TextKit } from "./textKit";

/**
 * A text kit for `locale` on the server (a page, an API route, an e-mail): the full messages of the language,
 * with Swedish behind every text a language does not have yet.
 */
export async function serverTextKit(locale: AppLocale): Promise<TextKit> {
  return makeTextKit(locale, await loadMessages(locale));
}
