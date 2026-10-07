import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale, type AppLocale } from "./locales";

/** The props of a page under src/app/[locale]: the address's language arrives as a promise. */
export type LocaleParams = { params: Promise<{ locale: string }> };

/**
 * The language of the page being rendered. Call it first in a page and in its generateMetadata: it tells
 * next-intl which language this is (so the page can be built once per language ahead of time instead of on
 * every visit), and shows the "page not found" page for an address with a language that does not exist.
 */
export async function pageLocale(params: LocaleParams["params"]): Promise<AppLocale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
