import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { LOCALES, type AppLocale } from "@/i18n/locales";
import { apiError } from "@/i18n/apiText";
import { localeOfRequest } from "@/i18n/requestLocale";
import { FAQ_IDS, FAQ_VALUES } from "@/lib/faq";
import {
  OMRADESANALYS_PRICE_SEK,
  TRE_BOSTADER_COUNT,
  TRE_BOSTADER_PRICE_SEK,
  TRYGGHETSPAKET_PRICE_SEK,
} from "@/lib/pricing";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// This route is deliberately open to anonymous visitors (it's a marketing-
// site support widget), which means the request-size/rate limits below are
// the *only* thing standing between it and an unbounded OpenAI bill - it had
// none of these before 2026-09's production-readiness pass (confirmed live:
// an unauthenticated POST with no caps succeeded). Keep all three checks
// (rate limit, message count, message length) even if one seems redundant.
const RATE_LIMIT_PER_MINUTE = 8;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REPLY_TOKENS = 300;

/**
 * The instruction to the language model. Written in Swedish for every language; what changes with the
 * visitor's language is the sentence that says which language to answer in, and the FAQ text it reads
 * (taken from the same message files as the FAQ on the site, in the visitor's language).
 */
async function buildSystemPrompt(locale: AppLocale): Promise<string> {
  const t = await getTranslations({ locale, namespace: "faq" });
  const answerLanguage =
    locale === "sv"
      ? "Du svarar på svenska."
      : `Du svarar på ${LOCALES[locale].englishName}. Fakta och FAQ nedan kan vara på ett annat språk, men du svarar alltid på ${LOCALES[locale].englishName}.`;
  const faqText = FAQ_IDS.map((id) => `F: ${t(`items.${id}.question`)}\nS: ${t(`items.${id}.answer`, FAQ_VALUES)}`).join("\n\n");

  return `Du är en kundtjänst-assistent för Köpanalys.se, en svensk tjänst som analyserar bostadsannonser. ${answerLanguage}

Här är fakta om produkten som du ska använda för att svara:

OM PRODUKTEN:
- Köpanalys ger en oberoende granskning av bostaden man vill köpa: föreningens ekonomi i klartext, området, möjliga risker och frågor att ställa till mäklaren och föreningen – samlat i en rapport. Köpanalys säljer inte bostaden eller priset, utan tryggheten att ha allt relevant inför köpet.
- BRF-analysen (föreningens ekonomi) granskas av en av Köpanalys experter innan kunden får den och är klar inom 24 timmar från köpet; kunden får ett mejl när den är klar. Har kunden föreningens årsredovisning kan den laddas upp i rapporten, annars tar Köpanalys fram den.
- Områdesanalysen och övriga automatiska delar är klara på några minuter.
- Boendekalkylen (månadskostnad och avgifter vid köpet) håller på att byggas och lanseras inom kort.
- Analysen bygger på föreningens årsredovisning och datakällor som Booli, SCB, Riksbanken, SMHI, Trafikverket, Skolverket, Lantmäteriet och OpenStreetMap.
- Analysen är ingen rådgivare och ger inga köprekommendationer – den klassificerar aldrig en bostad som "bra" eller "dåligt" köp och sätter inga poäng.
- Stödda bostadstyper: lägenheter (bostadsrätter), villor, radhus, parhus, kedjehus och fritidshus. Bostaden läggs in med skärmdumpar av annonsen eller genom att fylla i uppgifterna manuellt.

PRODUKTER:
- Områdesanalys: en egen, automatisk analys av området runt en adress (service, skolor, pendling, trygghet och samhällsdata, hur området utvecklas). Man får en rapport om området och inget annat.
- Trygghetspaketet: den fullständiga analysen av en bostad – BRF, området och dolda kostnader. Den som skapar en hel analys får alltid tillgång till hela rapporten.
- Det finns inga gratisanalyser och ingen Premium-nivå. En gratis karta med annonser är under utveckling men finns inte på sajten än.

PRISER OCH BETALNING:
- Betalning sker via Stripe med kort.
- Områdesanalys kostar ${OMRADESANALYS_PRICE_SEK} kr.
- Trygghetspaketet kostar ${TRYGGHETSPAKET_PRICE_SEK} kr per bostad och innehåller BRF-analys, områdesanalys och dolda kostnader.
- Paketet för tre bostäder kostar ${TRE_BOSTADER_PRICE_SEK} kr (${Math.round(TRE_BOSTADER_PRICE_SEK / TRE_BOSTADER_COUNT)} kr per bostad).
- Alla priser är engångsbetalningar inklusive moms. Köpanalys säljer inga abonnemang.

KONTO:
- Analysförfrågningar sparas på kontot för historik på dashboarden.
- Analysdata är cachad per bostad, inte personlig.
- Ett äldre abonnemang sägs upp under Köp & saldo i dashboarden.
- Konto kan helt tas bort via kontakt med support.

VIKTIGA BEGRÄNSNINGAR:
- Du får ALDRIG ge en köprekommendation eller utvärdera en specifik bostad. Om någon frågar om en specifik bostad, hänvisa dem att köra en analys på Köpanalys.se.
- Du kan bara svara på frågor om Köpanalys produkt. För frågor utanför produktens scope (allmän juridisk/finansiell rådgivning, orelaterade ämnen), avböj vänligen och föreslå att de kontaktar kontakt@kopanalys.se.
- Håll svaren korta: 2-4 meningar. Detta är en chat-widget, inte en lång text.

FAQ-innehåll som du kan använda som referens:
${faqText}`;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return apiError(503, "chat_unavailable", "chat.unavailable", undefined, { request });
  }

  const ip = clientIp(request);
  if (!checkRateLimit(`chat:${ip}`, RATE_LIMIT_PER_MINUTE, 60_000)) {
    return apiError(429, "rate_limited", "chat.rateLimited", undefined, { request });
  }

  let messages: Message[];
  let locale: AppLocale = localeOfRequest(request);
  try {
    const body = await request.json();
    messages = body.messages;
    // the language of the page the visitor is on (the chat widget sends it)
    locale = localeOfRequest(request, body.locale);
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "messages array is required" } },
        { status: 400 },
      );
    }
    if (
      !messages.every(
        (m) =>
          m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.length > 0 &&
          m.content.length <= MAX_MESSAGE_LENGTH
      )
    ) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: `Each message needs a role and content up to ${MAX_MESSAGE_LENGTH} characters.` } },
        { status: 400 },
      );
    }
    if (messages.length > MAX_MESSAGES) {
      // Keep the most recent turns rather than rejecting outright — a long
      // conversation shouldn't suddenly break, just lose older context.
      messages = messages.slice(-MAX_MESSAGES);
    }
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_request", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: MAX_REPLY_TOKENS,
      messages: [
        { role: "system" as const, content: await buildSystemPrompt(locale) },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("OpenAI API error:", response.status, errorBody);
    return apiError(503, "chat_unavailable", "chat.unavailable", undefined, { request, explicit: locale });
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content ?? "";

  return NextResponse.json({ reply });
}
