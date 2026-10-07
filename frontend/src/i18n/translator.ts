/**
 * Any translator that gives the text for a key: `useTranslations("namespace")` in a client component,
 * `await getTranslations("namespace")` (or with `{ locale, namespace }`) in a server component or an API route.
 *
 * Code that writes texts but runs in both places (the questions of the viewing guide, the summary, the
 * report builders ...) takes one of these as an argument instead of having Swedish sentences inside it, so the
 * same code gives each reader their own language. The key is loose here on purpose: the typed key check
 * happens where the translator is made.
 */
export type Translator = (key: any, values?: any) => string;
