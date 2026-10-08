import { NextResponse } from "next/server";
import { apiError } from "@/i18n/apiText";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/locales";
import { looksSwedish } from "@/lib/translate/looksSwedish";
import { translateTexts } from "@/lib/translate/translate";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Anyone can reach this (the public map translates what visitors wrote), and every translation costs processor time
// on the Python engine, so it is limited three ways: how often, how much in one request, and what it will translate
// (Swedish text only - lib/translate/looksSwedish.ts - and each text once: answers are stored).
const RATE_LIMIT_PER_MINUTE = 20;
const MAX_TEXTS = 40;
const MAX_TEXT_LENGTH = 1500;
const MAX_TOTAL_LENGTH = 12_000;

/**
 * POST /api/translate - { texts: string[], target: "en" } -> { translations: (string | null)[] }
 * `null` for a text that was left as it is: it is not Swedish, or it could not be translated now.
 */
export async function POST(request: Request) {
  if (!checkRateLimit(`translate:${clientIp(request)}`, RATE_LIMIT_PER_MINUTE, 60_000)) {
    return apiError(429, "rate_limited", "translate.rateLimited", undefined, { request });
  }

  const body = (await request.json().catch(() => null)) as { texts?: unknown; target?: unknown } | null;
  const texts = body?.texts;
  const target = body?.target;
  if (
    !Array.isArray(texts) ||
    texts.length === 0 ||
    texts.length > MAX_TEXTS ||
    !texts.every((text) => typeof text === "string" && text.length <= MAX_TEXT_LENGTH) ||
    (texts as string[]).reduce((sum, text) => sum + text.length, 0) > MAX_TOTAL_LENGTH ||
    !isLocale(target) ||
    target === DEFAULT_LOCALE
  ) {
    return apiError(400, "invalid_request", "translate.invalid", undefined, { request });
  }

  const wanted = (texts as string[]).map((text) => text.trim()).map((text) => (text !== "" && looksSwedish(text) ? text : null));
  const toTranslate = wanted.filter((text): text is string => text !== null);
  const done = toTranslate.length > 0 ? await translateTexts(toTranslate, target, { budgetMs: 30_000 }) : [];

  let next = 0;
  const translations = wanted.map((text) => (text === null ? null : (done[next++] ?? null)));
  return NextResponse.json({ translations });
}
