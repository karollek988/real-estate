import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { loadMessages } from "./messages";
import { routing } from "./routing";

/**
 * What next-intl needs for every request: which language it is, and that language's texts (with Swedish
 * behind any text that is missing). Registered with the plugin in next.config.ts.
 * Dates are in Swedish time whatever the visitor's own: a property viewing is at a Swedish clock time.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return { locale, messages: await loadMessages(locale), timeZone: "Europe/Stockholm" };
});
