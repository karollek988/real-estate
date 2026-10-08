import { LOCALE_CODES, type AppLocale } from "./locales";

/**
 * THE ADDRESS OF EVERY PAGE, IN EVERY LANGUAGE (optional per language).
 *
 * Every page is written once, in a folder named after its Swedish address: src/app/[locale]/priser/page.tsx
 * is the pricing page for every language. The keys below are those folder names - "internal addresses" -
 * and links in the code always use them (<Link href="/priser">). What a visitor sees in the browser's
 * address bar is decided here:
 *
 *   kopanalys.se/priser         Swedish (the default language has no prefix)
 *   kopanalys.se/en/pricing     English: the prefix, then the English name given for the page below
 *
 * To give a page an address name in another language, add it to that page's line:
 *   "/priser": { en: "/pricing", de: "/preise" },
 * A language that is not mentioned for a page uses the Swedish name (/de/priser), so a new language works
 * straight away and the address names can be added afterwards, or never.
 *
 * A NEW PAGE: create its folder once (src/app/[locale]/nytt-namn/page.tsx), put its texts in the message
 * files, and add one line here if it should have a different address in some language. If you skip the
 * line, TypeScript will not accept the page in <Link href="..."> until it is added - with
 * "/nytt-namn": {},  (an empty list means "same name in every language").
 *
 * Dynamic pages ([slug]) are written the same way: "/guider/[slug]": { en: "/guides/[slug]" }.
 */

type Names = Partial<Record<AppLocale, string>>;

/** One page's address in every language: the Swedish name, with the names given for other languages laid over it. */
function page(internal: string, names: Names = {}): Record<AppLocale, string> {
  return Object.fromEntries(LOCALE_CODES.map((code) => [code, names[code] ?? internal])) as Record<AppLocale, string>;
}

export const PATHNAMES = {
  "/": page("/"),

  // ── the public pages ──
  "/karta": page("/karta", { en: "/map" }),
  "/skapa-analys": page("/skapa-analys", { en: "/create-analysis" }),
  "/prisutveckling": page("/prisutveckling", { en: "/price-trends" }),
  "/omraden": page("/omraden", { en: "/areas" }),
  "/priser": page("/priser", { en: "/pricing" }),
  "/sa-fungerar-det": page("/sa-fungerar-det", { en: "/how-it-works" }),
  "/kontakt": page("/kontakt", { en: "/contact" }),
  "/nyheter": page("/nyheter", { en: "/news" }),
  "/nyheter/[slug]": page("/nyheter/[slug]", { en: "/news/[slug]" }),
  "/bostadsguider": page("/bostadsguider", { en: "/housing-guide" }),
  "/bostadsguider/[slug]": page("/bostadsguider/[slug]", { en: "/housing-guide/[slug]" }),
  "/insikter": page("/insikter", { en: "/insights" }),
  "/insikter/[slug]": page("/insikter/[slug]", { en: "/insights/[slug]" }),

  // ── buying, legal and the signed-in app (these already have English names) ──
  "/buy": page("/buy"),
  "/privacy": page("/privacy"),
  "/terms": page("/terms"),
  "/analyzing": page("/analyzing"),
  "/report": page("/report"),
  "/auth/confirmed": page("/auth/confirmed"),
  "/dashboard": page("/dashboard"),
  "/dashboard/buy": page("/dashboard/buy"),
  "/dashboard/coupons": page("/dashboard/coupons"),
  "/dashboard/inspection": page("/dashboard/inspection"),
  "/dashboard/privacy": page("/dashboard/privacy"),
  "/dashboard/settings": page("/dashboard/settings"),
  "/dashboard/subscriptions": page("/dashboard/subscriptions"),
} as const;

export type InternalPathname = keyof typeof PATHNAMES;
