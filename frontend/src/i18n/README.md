# Languages on Köpanalys

The site is written once. Every page exists once, in one folder, and every word a visitor reads is in a **message
file**, one set of files per language. Swedish is the master copy; English is the first translation.

```
src/i18n/
  locales.ts            the list of languages (add a language here)
  pathnames.ts          the address of every page in every language
  messages/
    index.ts            where each language's files are loaded from (add a language here too)
    sv/                 THE MASTER COPY: one file per area of the site (landing.ts, faq.ts, report.ts ...)
    en/                 the English translation: the same files, the same keys
  apiText.ts            answers of the API (error messages) in the language of the request
  textKit.ts            the way code that writes sentences (the report) gets its words
  ...                   (helpers for links, redirects, search-engine tags)
```

## What a visitor sees

- Swedish is at `kopanalys.se/priser`, English at `kopanalys.se/en/pricing`.
- There is a language picker in the header (and in the mobile menu and the footer).
- Nothing is guessed from the browser's language. A language is chosen by picking it, or by following a link to it.
  The pick is remembered in one functional cookie, `NEXT_LOCALE` (set only when the visitor picks; one year). It is
  described in the privacy policy (`messages/*/legal.ts`).
- A text that has not been translated yet is shown in Swedish, so a language can be added bit by bit.

## Add a language (say German, `de`)

1. Copy the folder `messages/en` to `messages/de` and translate the values in every file. Keep the keys, the
   `{placeholders}` and the `<tags>`. (Not ready to translate everything? Delete the files you have not translated
   and the lines for them in `messages/de/index.ts`, and type the messages as `DeepPartial<Messages>`. What is
   missing is shown in Swedish.)
2. Add an entry for `de` to `LOCALES` in `locales.ts` (name, `htmlLang`, `formatLocale`, `ogLocale`, `stripeLocale`,
   `englishName`).
3. Add one line for `de` to `LOADERS` in `messages/index.ts`. TypeScript refuses to compile until you do.
4. Optional: give the pages translated address names in `pathnames.ts` (`"/priser": { en: "/pricing", de: "/preise" }`).
   A language without a name for a page uses the Swedish one.
5. Run `npm run i18n:check -- de`. It lists what is missing and reports texts whose `{placeholders}` or `<tags>` differ
   from the Swedish text, or are not valid message syntax. The picker, the sitemap, the e-mails, the payment page and
   the chat assistant pick the new language up from `locales.ts`; nothing else has to change.

Terminology (one Swedish word, one English word, on every page) is at the top of `messages/en/index.ts`. Do the same
for a new language.

## Add or change a text

- Every text has a **key**: the area (the file name), then where it is: `landing.hero.title`. The Swedish file defines it;
  every other language has the same key.
- In a **server component** (a page): `const t = await getTranslations("landing")` then `t("hero.title")`.
- In a **client component** (starts with `"use client"`): `const t = useTranslations("landing")`. The page must send the
  area to the browser: wrap the client components in `<ClientMessages areas={["landing"]}>` (see `ClientMessages.tsx`).
- A **new area** is a new file `messages/sv/<area>.ts` plus the same file in every other language, and one line
  for it in each `messages/<language>/index.ts`.
- Change the Swedish text and the keys together with the translations. `npm run i18n:check` and `tsc` tell you
  what is out of step.

### Writing messages (message syntax)

- `{name}` is replaced by the code. `{count, plural, one {# flat} other {# flats}}` picks a form by number.
  `{x, select, up {higher} other {lower}}` picks by a word.
- Amounts: `{price, number}` writes the number the way the language does (`2 495 000` / `2,495,000`). The currency is in the
  text (`{price, number} kr` / `SEK {price, number}`).
- Bold and links: `<b>text</b>`, `<link>text</link>`. The tags have to be written in pairs, also when empty:
  `<br></br>`, not `<br/>`. The page decides what a tag becomes (`t.rich(...)`).
- An apostrophe is an ordinary character, except right before `{`, `}`, `<` or `>`.
- A space that must not break a line: ` ` inside the quotes of a `.ts` file.

## Add a page

Create `src/app/[locale]/<swedish-name>/page.tsx` once. Put its words in the message files. Add one line to
`pathnames.ts` (`"/nytt-namn": {}` means the same address in every language; `{ en: "/new-name" }` gives English a
different one). Link to it with `Link` from `@/i18n/navigation`. Start the page with `await pageLocale(params)` and give it
`generateMetadata` using `pageMetadata(...)` from `@/i18n/seo` (title, description, language alternates).

## Code that writes sentences

The report, the housing association analysis, the viewing guide and the e-mails are made by code that is not a React
component. They take a **text kit** (`textKit.ts`): the language, the way numbers and dates are written in it, and a
translator for the whole message set. On a server: `await serverTextKit(locale)`. In a component: `useTextKit()`.
Numbers, kronor and dates are written with `createFormat(kit)` (`lib/report/format.ts`), never by hand.
Swedish-only code (the review console, the verify scripts) uses `swedishTextKit({ report, brf })`.

## The API and e-mails

- Error messages shown to visitors are in `messages/*/apiErrors.ts`. In a route: `return apiError(429, "rate_limited", "stripe.rateLimited")`.
  The language is that of the page the request came from (the `Referer`), or a `locale` the page sends along (the chat and
  the payment do). Messages for developers stay in English in the code.
- E-mails to customers are in `messages/*/emails.ts` and are written in the language stored with the account
  (`user_metadata.locale`, set at sign-up and updated when the customer orders from a page in another language).
  E-mails to the team are in Swedish only.

## Things that are deliberately not translated

- Texts written by people in the data: listing descriptions, the reviewer's comment and planned works in a housing association
  analysis, listings visitors add to the map. They are shown as written (marked with `lang="sv"` where it matters). Common
  terms in the listing data are mapped to the reader's language (`report.overview.terms.*`).
- The guides, blog articles and knowledge articles (Swedish only for now; the English address shows the Swedish text and is
  not listed for search engines).
- The admin portal and the review console (Swedish only).
- The legal texts have a translation, but the Swedish text is the one that applies (the pages say so).

## Checking

```
npm run i18n:check          every language against the Swedish master copy
npm run i18n:check -- en    one language, with every missing key listed
npx tsc --noEmit            a typed language (Messages) cannot miss a key
npx tsx src/i18n/i18n.verify.mjs   addresses, the language of a request, the fall-back to Swedish
```
