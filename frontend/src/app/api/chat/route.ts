import { NextResponse } from "next/server";
import { FAQ_ITEMS } from "@/lib/faq";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Du är en kundtjänst-assistent för Köpanalys.se, en svensk tjänst som analyserar bostadsannonser. Du svarar på svenska.

Här är fakta om produkten som du ska använda för att svara:

OM PRODUKTEN:
- Köpanalys sammanställer offentlig data om en bostad till en analysrapport – historiska försäljningar, föreningens ekonomi, områdesfakta, ränteläge och mer.
- Analysen tar 30 sekunder till 2 minuter att generera.
- Analysen bygger på datakällor som Booli, SCB, Riksbanken, SMHI, Trafikverket, Lantmäteriet och OpenStreetMap.
- Analysen är ingen rådgivare och ger inga köprekommendationer – den klassificerar aldrig en bostad som "bra" eller "dåligt" köp.
- Stödda bostadstyper: lägenheter (bostadsrätter), villor, radhus, parhus, kedjehus, fritidshus, tomter och gårdar.
- Endast länkar från Hemnet av typen /bostad/... stöds.

GRATIS VS PREMIUM:
- Nya användare får 3 gratisanalyser direkt vid registrering.
- Gratisanalysen visar: grundläggande bostadsfakta (adress, storlek, pris, avgift) och prisbedömningen (lågt/högt jämfört med liknande försäljningar).
- Premiumanalysen innehåller allt i gratisanalysen plus analys av närliggande serviceutbud, infrastrukturprojekt, BRF-ekonomi i detalj och fullt beslutsunderlag.

PRISER OCH BETALNING:
- Betalning sker via Stripe med kort.
- Premium finns som engångsköp (per analys) och som månadsprenumeration.
- Produkter: Premium månadsvis (prenumeration), Ultra månadsvis (prenumeration), Premium Beslutsanalys (engångsköp).
- Specifika priser visas i samband med betalning.

KONTO:
- Analysförfrågningar sparas på kontot för historik på dashboarden.
- Analysdata är cachad per bostad, inte personlig.
- Prenumeration sägs upp via dashboardens inställningar.
- Konto kan helt tas bort via kontakt med support.

VIKTIGA BEGRÄNSNINGAR:
- Du får ALDRIG ge en köprekommendation eller utvärdera en specifik bostad. Om någon frågar om en specifik bostad, hänvisa dem att köra en analys på Köpanalys.se.
- Du kan bara svara på frågor om Köpanalys produkt. För frågor utanför produktens scope (allmän juridisk/finansiell rådgivning, orelaterade ämnen), avböj vänligen och föreslå att de kontaktar contact@kopanalys.se.
- Håll svaren korta: 2-4 meningar. Detta är en chat-widget, inte en lång text.

FAQ-innehåll som du kan använda som referens:
${FAQ_ITEMS.map((item) => `F: ${item.question}\nS: ${item.answer}`).join("\n\n")}`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          code: "chat_unavailable",
          message:
            "Chatten är inte tillgänglig just nu – kontakta oss på contact@kopanalys.se istället.",
        },
      },
      { status: 503 },
    );
  }

  let messages: Message[];
  try {
    const body = await request.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "messages array is required" } },
        { status: 400 },
      );
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
      messages: [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("OpenAI API error:", response.status, errorBody);
    return NextResponse.json(
      {
        error: {
          code: "chat_unavailable",
          message:
            "Chatten är inte tillgänglig just nu – kontakta oss på contact@kopanalys.se istället.",
        },
      },
      { status: 503 },
    );
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content ?? "";

  return NextResponse.json({ reply });
}
