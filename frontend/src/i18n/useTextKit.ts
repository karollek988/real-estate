import { useLocale, useTranslations } from "next-intl";
import { LOCALES, type AppLocale } from "./locales";
import type { Translator } from "./translator";
import type { TextKit } from "./textKit";

/** The text kit of the page being shown, in a server or a client component. The areas the code reads must have been sent to the browser (ClientMessages). */
export function useTextKit(): TextKit {
  const locale = useLocale() as AppLocale;
  const t = useTranslations() as unknown as Translator;
  return { locale, formatLocale: LOCALES[locale].formatLocale, t };
}
