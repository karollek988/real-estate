import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "./locales";
import { localeOfRequest } from "./requestLocale";
import type { Translator } from "./translator";

/**
 * The texts an API route answers with (the "apiErrors" messages), in the language of the request: the page it
 * was made from, or `explicit`, a language the page states itself (the chat and the payment send theirs along).
 * Without a `request` the language is read from the request that is being handled right now.
 *
 *   const { t, locale } = await apiTexts();
 */
export async function apiTexts(request?: Pick<Request, "headers">, explicit?: unknown) {
  const locale: AppLocale = localeOfRequest(request ?? { headers: await headers() }, explicit);
  const t = await getTranslations({ locale, namespace: "apiErrors" });
  /** The same texts for a key that is put together (essentialFields.<id>), which TypeScript cannot check. */
  const loose = t as unknown as Translator & { has: (key: string) => boolean };
  return { locale, t, loose };
}

/** A key of the "apiErrors" messages. */
export type ApiErrorKey = Parameters<Awaited<ReturnType<typeof apiTexts>>["t"]>[0];

/**
 * The JSON answer of a failed request: { error: { code, message } }, with the message in the language of the
 * request. `code` is for programs (the page tests it), `message` is what the visitor reads.
 */
export async function apiError(
  status: number,
  code: string,
  key: ApiErrorKey,
  values?: Record<string, string | number>,
  language?: { request?: Pick<Request, "headers">; explicit?: unknown },
): Promise<NextResponse> {
  const { t } = await apiTexts(language?.request, language?.explicit);
  return NextResponse.json({ error: { code, message: t(key, values) } }, { status });
}
