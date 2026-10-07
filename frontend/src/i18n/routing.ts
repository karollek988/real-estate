import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALE_CODES } from "./locales";
import { PATHNAMES } from "./pathnames";

/**
 * How addresses and languages fit together (the settings of next-intl's routing):
 *   - Swedish, the default, has no prefix (kopanalys.se/priser); every other language has one (/en/pricing).
 *   - Nothing is redirected from the browser's language: a visitor gets a language by picking one in the
 *     language switcher (which remembers it, see LanguageSwitcher) or by following a link to it.
 *   - next-intl's own language cookie is switched off: the only cookie is the one the switcher sets when
 *     a visitor actively chooses a language (a functional cookie, described in the privacy policy).
 * The address names of the pages are in pathnames.ts.
 */
export const routing = defineRouting({
  locales: LOCALE_CODES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
  pathnames: PATHNAMES,
});
