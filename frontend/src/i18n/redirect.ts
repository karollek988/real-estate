import { DEFAULT_LOCALE, type AppLocale } from "./locales";
import { getPathname } from "./navigation";
import { resolveInternal } from "./path";

/**
 * The same address in another language: https://kopanalys.se/priser -> https://kopanalys.se/en/pricing.
 * The address is the one of a page in the default language (the page's own name). Returns the address
 * unchanged when the language is the default one, or when it is not a page of the site.
 */
export function localizeUrl(url: URL, locale: AppLocale): URL {
  if (locale === DEFAULT_LOCALE) return url;
  const page = resolveInternal(url.pathname);
  if (!page) return url;
  const href = Object.keys(page.params).length > 0 ? { pathname: page.pathname, params: page.params } : page.pathname;
  const localized = new URL(url);
  localized.pathname = getPathname({ locale, href } as Parameters<typeof getPathname>[0]);
  return localized;
}
