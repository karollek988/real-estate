import { revalidatePath } from "next/cache";
import { DEFAULT_LOCALE, LOCALE_CODES, type AppLocale } from "@/i18n/locales";
import { getPathname } from "@/i18n/navigation";
import type { ContentItem } from "@/lib/content/model";
import { contentLink, hubLink } from "@/lib/content/paths";
import { assembleMarkdown, piecesOf, textsOf } from "./markdown";
import { translateTexts, type TranslateOptions } from "./translate";

/**
 * Guides, insights and news in the reader's language (the editor writes them in Swedish only). Server-only.
 *
 *   localizeItem(item, "en")    one article with its text: title, summary, picture text, search texts and body
 *   localizeItems(items, "en")  the cards of a hub: title, summary and picture text
 *   translateOnPublish(item)    translates a saved article in every other language, in the background
 *
 * An article that could not be translated (the translator is not there) is given back as it was written: the page
 * then shows the Swedish text, without the "translated automatically" note, and is not offered to search engines
 * in that language (contentRoute.tsx).
 */

/** How long a page that is being built waits for translations before it shows what it has. */
export const PAGE_BUDGET_MS = 25_000;

const COVER_ALT_MAX = 200;

/** Translated texts must still fit the limits the editor enforces. */
const fit = (text: string, max: number) => (text.length > max ? text.slice(0, max).trimEnd() : text);

export async function localizeItem(item: ContentItem, locale: AppLocale, options: TranslateOptions = { budgetMs: PAGE_BUDGET_MS }): Promise<ContentItem> {
  if (locale === DEFAULT_LOCALE) return item;

  const { pieces } = piecesOf(item.body);
  const head = [item.title, item.excerpt, item.coverImageAlt, item.seoTitle ?? "", item.seoDescription ?? ""];
  const answers = await translateTexts([...head, ...textsOf(pieces)], locale, options);

  const [title, excerpt, alt, seoTitle, seoDescription] = answers;
  if (title === null) return item; // nothing could be translated: the article stays as it was written

  const body = pieces.length > 0 ? assembleMarkdown(pieces, answers.slice(head.length)).markdown : "";
  return {
    ...item,
    title: fit(title, 160),
    excerpt: excerpt ?? item.excerpt,
    coverImageAlt: fit(alt ?? item.coverImageAlt, COVER_ALT_MAX),
    seoTitle: item.seoTitle ? (seoTitle ?? item.seoTitle) : null,
    seoDescription: item.seoDescription ? (seoDescription ?? item.seoDescription) : null,
    body: pieces.length > 0 ? body : item.body,
    translatedFrom: DEFAULT_LOCALE,
  };
}

/** The cards of a hub (their bodies are not loaded). */
export async function localizeItems(items: ContentItem[], locale: AppLocale, options: TranslateOptions = { budgetMs: PAGE_BUDGET_MS }): Promise<ContentItem[]> {
  if (locale === DEFAULT_LOCALE || items.length === 0) return items;
  const answers = await translateTexts(
    items.flatMap((item) => [item.title, item.excerpt, item.coverImageAlt]),
    locale,
    options,
  );
  return items.map((item, i) => {
    const [title, excerpt, alt] = answers.slice(i * 3, i * 3 + 3);
    if (title === null) return item;
    return { ...item, title: fit(title, 160), excerpt: excerpt ?? item.excerpt, coverImageAlt: fit(alt ?? item.coverImageAlt, COVER_ALT_MAX), translatedFrom: DEFAULT_LOCALE };
  });
}

/** The languages an article is translated into: every language of the site but the one it is written in. */
export function translationTargets(): AppLocale[] {
  return LOCALE_CODES.filter((code) => code !== DEFAULT_LOCALE);
}

/**
 * Translates a saved, published article in every other language, with no time limit, and rebuilds the pages
 * it appears on so the translation shows at once. Called by the editor's save (adminStore.ts) after the
 * response has gone out; failures are logged and never reach the editor - the first reader's visit tries again.
 */
export async function translateOnPublish(item: ContentItem): Promise<void> {
  if (item.status !== "published") return;
  for (const locale of translationTargets()) {
    try {
      // title, summary and text in one go: the hub's cards use the same translated title and summary
      const localized = await localizeItem(item, locale, {});
      if (localized.translatedFrom) {
        revalidatePath(getPathname({ locale, href: contentLink(item) }));
        revalidatePath(getPathname({ locale, href: hubLink(item.type) }));
      }
    } catch (err) {
      console.warn(`[translate] ${item.type}/${item.slug} could not be translated into ${locale}:`, err instanceof Error ? err.message : err);
    }
  }
}
