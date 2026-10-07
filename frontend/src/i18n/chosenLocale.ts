import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type AppLocale } from "./locales";

/**
 * The language a visitor chose in the language picker, from its cookie: used by the sign-in routes, which
 * send people on to a page and want it to be in their language. The default language when none was chosen.
 */
export async function chosenLocale(): Promise<AppLocale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
