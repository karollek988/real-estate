/**
 * THE LIST OF LANGUAGES THE SITE IS AVAILABLE IN.
 *
 * To add a language, say German ("de"), see src/i18n/README.md - the short version:
 *   1. copy the folder  src/i18n/messages/en  to  src/i18n/messages/de  and translate the texts in it;
 *   2. add an entry for "de" below;
 *   3. add one line for "de" in src/i18n/messages/index.ts;
 *   4. (optional) give its pages translated address names in src/i18n/pathnames.ts.
 * Nothing else has to change: pages, components and the language switcher pick the new language up
 * from here. Run  npm run i18n:check  to see which texts are still missing in a language (anything
 * missing is shown in Swedish until it is translated, so a language can be added bit by bit).
 *
 * This file is imported in the browser too (by the language switcher): keep it small and free of
 * anything heavy. The texts themselves are in src/i18n/messages and are never imported from here.
 */

export interface LocaleInfo {
  /** The language's own name, as the switcher shows it ("Svenska", "English", "Deutsch"). Never a flag: a flag is a country. */
  name: string;
  /** The <html lang> value and hreflang for search engines (BCP 47: "sv", "en", "de"). */
  htmlLang: string;
  /** The locale used for numbers, dates and currencies ("sv-SE", "en-GB"). */
  formatLocale: string;
  /** Open Graph's name for it (used when a page is shared): "sv_SE", "en_GB". */
  ogLocale: string;
  /** Stripe Checkout's language code (https://docs.stripe.com/api/checkout/sessions/object#checkout_session_object-locale); "auto" lets Stripe decide. */
  stripeLocale: string;
  /** The language's name in English, for instructing the AI chat assistant ("Answer in English"). */
  englishName: string;
}

export const LOCALES = {
  sv: {
    name: "Svenska",
    htmlLang: "sv",
    formatLocale: "sv-SE",
    ogLocale: "sv_SE",
    stripeLocale: "sv",
    englishName: "Swedish",
  },
  en: {
    name: "English",
    htmlLang: "en",
    formatLocale: "en-GB",
    ogLocale: "en_GB",
    stripeLocale: "en",
    englishName: "English",
  },
  // de: { name: "Deutsch", htmlLang: "de", formatLocale: "de-DE", ogLocale: "de_DE", stripeLocale: "de", englishName: "German" },
} as const satisfies Record<string, LocaleInfo>;

/** A language code that is on the list: "sv" | "en" | ... */
export type AppLocale = keyof typeof LOCALES;

/** The language every text falls back to, and the one served without a prefix in the address (kopanalys.se/priser). */
export const DEFAULT_LOCALE: AppLocale = "sv";

/** All codes, the default first. */
export const LOCALE_CODES = Object.keys(LOCALES) as [AppLocale, ...AppLocale[]];

export const isLocale = (value: unknown): value is AppLocale => typeof value === "string" && Object.prototype.hasOwnProperty.call(LOCALES, value);

/** The cookie that remembers a visitor's own choice of language. Set only when the visitor picks a language, never otherwise. */
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_DAYS = 365;
