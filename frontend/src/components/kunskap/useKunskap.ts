import { useLocale, useTranslations } from "next-intl";
import { LOCALES, type AppLocale } from "@/i18n/locales";
import type { ContentCategorySlug } from "@/lib/content/model";

/** "7 oktober 2026" / "7 October 2026": a date of an article in the reader's language, in Swedish time. */
export function formatArticleDate(iso: string, locale: AppLocale): string {
  return new Intl.DateTimeFormat(LOCALES[locale].formatLocale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Stockholm" }).format(
    new Date(iso),
  );
}

/** The date formatter and the texts the cards and article pages share. Works in server and client components. */
export function useKunskap() {
  const t = useTranslations("kunskap");
  const locale = useLocale() as AppLocale;
  return {
    t,
    locale,
    date: (iso: string) => formatArticleDate(iso, locale),
    /** The name of a Bostadsguiden subject in the reader's language. */
    categoryLabel: (slug: ContentCategorySlug) => t(`categories.${slug}.label`),
    categoryDescription: (slug: ContentCategorySlug) => t(`categories.${slug}.description`),
  };
}
