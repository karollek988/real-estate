"""OpenAI implementation of NarrationProvider.

Only this file knows about the `openai` package or OPENAI_API_KEY — adding
Anthropic or Gemini later means adding one sibling file implementing the
same NarrationProvider interface, nothing else changes.
"""

from __future__ import annotations

import json
import os

from .base import NarrationError, NarrationPayload, NarrationProvider
from .payload import payload_to_dict

SYSTEM_PROMPT = """Du är redaktör för Köpanalys BRF-rapporter. Du skriver om en \
redan färdig, deterministisk analys till naturlig, professionell svenska.

Köpanalys är INTE en rådgivare och ger INGA köprekommendationer. Rapporten \
förklarar vad verifierade uppgifter visar - den klassificerar aldrig \
föreningen eller bostaden med subjektiva omdömen.

Du får ENDAST den strukturerade JSON-data som följer. Den datan är den enda \
källan till sanning och kommer från ett regelbaserat analyssystem som redan \
har fattat alla beslut.

Du FÅR:
- sammanfatta det som redan finns i datan
- förklara innebörden av signaler och slutsatser
- förbättra läsbarheten och flytet
- skriva naturlig, sammanhängande svenska
- skriva allmän, generell utbildande kontext om vad ett nyckeltal brukar \
innebära (t.ex. "hög belåning innebär generellt större känslighet för \
ränteförändringar") - aldrig som ett omdöme om just denna förening

Du FÅR ALDRIG:
- räkna ut eller ändra ett nyckeltal
- hitta på fakta som inte finns i JSON-datan
- skapa eller ändra en poäng, bedömning eller "verdict"
- dra egna riskslutsatser utöver det som redan står i "findings"
- nämna ett värde som inte finns i datan
- använda värderande ord som "bra", "dålig", "stark", "svag", "sund", \
"köpvärd", "olämplig" eller liknande adjektiv som inte är direkt hämtade \
ur datan
- skriva rekommendationer, råd eller uppmaningar ("bör", "måste", \
"rekommenderas", "kontrollera", "fråga styrelsen" etc.) eller antyda att \
något stöder eller talar emot ett köp
- förutsäga vad som kommer hända (t.ex. framtida avgiftshöjningar) - \
beskriv bara vad den tillgängliga datan visar just nu
- uttrycka högre säkerhet än datan visar - om ett fält saknas eller \
underlaget är tunt, säg det rakt ut istället för att fylla i en slutsats

Varje mening du skriver måste kunna härledas till ett fält i JSON-datan. Om \
datan är tunn, skriv en kort text — hitta aldrig på fyllnadsinnehåll.

Skriv 2-4 sammanhängande stycken om objektets ekonomiska läge, baserat på \
"observations" och "findings" ("recommendations" är normalt tom - om den \
innehåller poster, sammanfatta dem på samma icke-rådgivande sätt som allt \
annat). Ingen rubrik, ingen inledande fras som "Här är en sammanfattning" — \
gå rakt in i texten. Ren text, ingen markdown, inga punktlistor."""


class OpenAINarrationProvider(NarrationProvider):
    def __init__(
        self,
        model: str = "gpt-4o-mini",
        api_key: str | None = None,
        timeout: float = 30.0,
    ) -> None:
        self._model = model
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self._timeout = timeout

    def narrate(self, payload: NarrationPayload) -> str:
        if not self._api_key:
            raise NarrationError("OPENAI_API_KEY is not set")

        try:
            from openai import OpenAI
        except ImportError as exc:
            raise NarrationError(f"openai package not installed: {exc}") from exc

        client = OpenAI(api_key=self._api_key, timeout=self._timeout)
        user_content = json.dumps(payload_to_dict(payload), ensure_ascii=False, indent=2)

        try:
            response = client.chat.completions.create(
                model=self._model,
                temperature=0.2,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
            )
        except Exception as exc:  # noqa: BLE001 - any provider failure must degrade, never crash the report
            raise NarrationError(f"OpenAI call failed: {exc}") from exc

        choices = response.choices
        text = choices[0].message.content if choices else None
        if not text or not text.strip():
            raise NarrationError("OpenAI returned empty narration")
        return text.strip()
