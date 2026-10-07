import {
  OMRADESANALYS_PRICE_SEK,
  TRE_BOSTADER_COUNT,
  TRE_BOSTADER_PRICE_SEK,
  TRYGGHETSPAKET_PRICE_SEK,
} from "@/lib/pricing";

/**
 * The frequently asked questions: which there are, and in what order. The questions and answers themselves
 * are text and live in the message files (src/i18n/messages/<language>/faq.ts, under `items.<id>`), one
 * version per language. Also the chat assistant's reference text (api/chat/route.ts) - keep every answer
 * true to what the product does today. The first ten are the questions buyers ask first; the landing page
 * shows those before "Visa alla frågor".
 */
export const FAQ_IDS = [
  "vad-ar-kopanalys",
  "hur-fungerar-det",
  "datakallor",
  "hur-saker",
  "pris",
  "vilka-bostader",
  "vad-ingar",
  "hur-lang-tid",
  "innan-visning",
  "maklare-besiktning",
  "vem-granskar-brf",
  "arsredovisning",
  "bra-eller-daliga-siffror",
  "radgivning",
  "boendekalkyl",
  "omradesanalys",
  "ingen-analys-kvar",
  "ai",
  "sokhistorik",
  "pdf",
  "avsluta-konto",
] as const;

/** A question's stable id: a page picks questions by it (/priser shows the ones about buying). */
export type FaqId = (typeof FAQ_IDS)[number];

/** The prices that answers mention, handed to every answer (an answer uses the ones it needs). */
export const FAQ_VALUES = {
  areaPrice: OMRADESANALYS_PRICE_SEK,
  packagePrice: TRYGGHETSPAKET_PRICE_SEK,
  bundlePrice: TRE_BOSTADER_PRICE_SEK,
  perHome: Math.round(TRE_BOSTADER_PRICE_SEK / TRE_BOSTADER_COUNT),
};

/** The questions /priser answers next to the packages. */
export const PURCHASE_FAQ_IDS: readonly FaqId[] = ["pris", "vad-ingar", "omradesanalys", "ingen-analys-kvar", "hur-lang-tid", "vem-granskar-brf"];
