import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type AppLocale } from "./locales";
import { splitLocale } from "./path";

/**
 * The language a request to the API says it is from, or null when it says nothing: the language of the page
 * the request was made from (the browser sends that address as "Referer": /en/dashboard -> English), else the
 * language the visitor picked in the language picker (its cookie).
 */
export function statedLocaleOfRequest(request: Pick<Request, "headers">): AppLocale | null {
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return splitLocale(new URL(referer).pathname).locale;
    } catch {
      // not an address: fall through to the cookie
    }
  }

  const cookie = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  return isLocale(cookie) ? cookie : null;
}

/**
 * Which language a request to the API came from, so that the answer (an error message, an e-mail, the
 * chat reply) can be in it. In order: a language the page states itself (`explicit`), then what the request
 * says (see statedLocaleOfRequest), and last the default language.
 */
export function localeOfRequest(request: Pick<Request, "headers">, explicit?: unknown): AppLocale {
  if (isLocale(explicit)) return explicit;
  return statedLocaleOfRequest(request) ?? DEFAULT_LOCALE;
}
