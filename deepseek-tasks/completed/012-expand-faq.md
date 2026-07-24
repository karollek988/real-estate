# Task 012 — Expand FAQ to at least 13 questions

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

`frontend/src/components/sections/FaqSection.tsx` has a `FAQ_ITEMS` array with only 5
entries today. Product requirement: expand to **at least 13** questions.

Messaging direction from the product owner: the FAQ should communicate that Köpanalys
sells **trygghet genom fakta och matematik** (peace of mind through facts and math) —
i.e. reducing the anxiety/uncertainty of a property purchase by grounding the decision in
large amounts of verifiable data rather than gut feeling or a broker's sales pitch. Keep
every answer strictly consistent with the product's existing non-advisory positioning —
Köpanalys reports what data shows, it never gives a purchase recommendation or verdict
(see `analysis_engine/narrator/openai_provider.py`'s system prompt for the established
house tone if you want a concrete reference for how this product always talks about
itself — don't contradict that anywhere in the FAQ).

## Goal

Keep the 5 existing questions (rephrase only if needed for consistency with new ones —
don't remove information that's already accurate). Add new questions covering, at
minimum:

- Vad är egentligen en Köpanalys-rapport till för? (tie directly to the
  trygghet-genom-fakta positioning)
- Ger ni köprådgivning / säger ni om jag ska köpa eller inte? (answer: no — explicit,
  matching the non-advisory positioning)
- Hur många gratisanalyser får jag? (3, per the current quota system —
  see `supabase/migrations/20260723000300_quota_defaults.sql`)
- Vad är skillnaden mellan gratis- och Premium-analys? (tie to
  `deepseek-tasks/completed/006-shorten-free-report.md`'s actual free-vs-premium content
  difference — read that file so this answer is factually accurate, not a guess)
- Vad kostar en Premium-analys / hur betalar jag? (Stripe, one-time purchase or
  subscription — see `frontend/src/lib/stripe/prices.ts` for the actual price tiers/keys
  that exist today, don't invent numbers not backed by real Stripe price configuration)
- Vad händer om jag inte har några Premium-analyser kvar men vill se en rapport? (the
  paywall flow from `deepseek-tasks/completed/008-premium-paywall.md` — the analysis
  still runs, the report is locked until payment)
- Hur snabb är en analys? (see the `analyzing` page's stated ~1.5 min expectation,
  `frontend/src/app/analyzing/page.tsx`)
- Vilka bostadstyper stöds? (existing house/apartment answers, plus be honest that only
  Hemnet `/bostad/...` listing links are supported today — not other providers or
  new-construction project pages, per `frontend/src/lib/analysis/listing/hemnet.ts`)
- Var kommer datan ifrån / hur många källor använder ni? (reference the actual provider
  set used — check `frontend/src/lib/analysis/providers/` for the real list rather than
  inventing a number)
- Kan jag lita på siffrorna om jag inte hittar dem själv? / Hur verifierar ni datan?
- Sparar ni min sökhistorik / mina analyser? (tie to `/dashboard/privacy` from task 011
  if that's already been done — check `deepseek-tasks/completed/` — otherwise a general
  accurate answer)
- Kan jag ladda ner rapporten som PDF?
- Hur avbokar/avslutar jag mitt konto?

Add more if natural, but hit at least 13 total. Every factual claim (price, quota number,
data source count, feature availability) must be traceable to something real in this
codebase — do not invent numbers or capabilities that don't exist. If you're not sure a
claim is accurate, phrase it more generally rather than stating a specific unverified
number.

## Definition of done

- `FAQ_ITEMS` has at least 13 entries, all factually grounded per the above.
- Visual/interaction pattern (accordion, styling) stays exactly as it already is — no
  changes to how the FAQ section renders, only to its content array.
- `npm run build` passes in `frontend/`.
- Final summary: final question count, and a list of any claims you were unsure about and
  phrased conservatively rather than guessing a specific number.
