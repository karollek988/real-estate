# Real Estate — analysrapporter för bostadsköp

En tjänst som genererar analysrapporter för bostadsannonser (initial marknad:
Sverige). Rapporten kombinerar Hemnet-annonsdata, BRF-årsredovisningar samt
plats- och marknadsdata till en pris-, område-, risk- och
förhandlingsanalys, levererad som PDF.

**Primär målgrupp: mäklare** (B2B — mäklare tar fram rapporter åt sina
kunder). **Sekundär målgrupp: privatpersoner** (B2C — köper enstaka
rapporter eller prenumeration själva).

**Status:** Kärnflödet fungerar end-to-end för privatpersoner — annons in,
analys, PDF-rapport ut, betalning via Stripe. Det som **saknas** för att
sälja till mäklare är ett mäklarkonto (organisation/team, flera
klientrapporter per mäklare) — dagens konto-/betalmodell är byggd för en
enskild användare i taget. Se `notion-project-plan-prompt.md` för
projektplan mot lansering hos mäklare.

## Layout

Produkten är byggd som en Next.js-app plus ett par fristående Python-motorer
för tunga datapipelines, inte som ett enda monolitiskt Python-paket.

```
frontend/                     Huvudprodukten (Next.js + Supabase)
  src/app/                    Sidor + API-routes (auth, Stripe, analyser, rapporter, inspektion)
  src/lib/analysis/           Annons-extraktion (Hemnet) + analysmotor (pris/område/BRF/risk/förhandling)
  src/lib/analysis/providers/ Datakällor: Booli, SCB, OSM, Riksbanken, SMHI, Trafikverket, BRF-finans, m.fl.
  src/lib/report/             Sammanställning av rapport-data + PDF-rendering
  src/lib/stripe/, src/lib/auth/  Betalning (checkout/portal/webhook) och Supabase-auth
  src/lib/inspection/         Bostadsinspektionsmodul (rum-för-rum-observationer)

BRF-Scraper/                  Fristående Python-pipeline: hittar, laddar ner och tolkar BRF-årsredovisningar
analysis_engine/              Python: finansiell kalkylator + LLM-narration för BRF-data
src/location_intelligence/    Platsdata-providers (geokodning, SCB, Kolada, skola/brott/kollektivtrafik där tillgängligt) — v1.0.0, validerad
src/market_intelligence/      Marknadsdata-providers (ränta, energipriser, bostadsprisindex m.m.)
api/                          FastAPI-wrapper som exponerar location/market intelligence
supabase/                     DB-schema via SQL-migrationer (profiles, properties, analyses, quotas, Stripe, inspections)
docs/                         Design- och researchdokument (~45 filer)
notion-project-plan-prompt.md Prompt att klistra in i Notion för att bygga projektplanen mot mäklarlansering

src/real_estate/               Ursprunglig Python-skeleton — ersätt av ovanstående, betrakta som inaktuell/vestigial
Market_Intelligence_Engine/    Endast Docker-scaffold, ingen källkod — klärggör om den behövs eller kan tas bort
Future_investment_engine/      I praktiken tom — motsvarande logik ligger idag i src/lib/analysis/engine/analyzers/futureDevelopment.ts
```

## Vad fungerar idag

- **Hemnet-scraping**: flerstegs extraktion (Apollo-state, JSON-LD, semantisk
  HTML, regex-fallback) som slås ihop med en confidence-modell, plus manuell
  inmatning som alternativ när scraping inte räcker till.
- **Analysmotor**: pris-, område-, marknad-, risk-, förhandlings- och
  BRF-analys, med explicit confidence-hantering per datakälla.
- **BRF-årsrapportanalys**: egen Python-pipeline (`BRF-Scraper/`) som hittar
  och tolkar årsredovisningar, plus finansiell kalkylator och
  LLM-narration (`analysis_engine/`).
- **PDF-rapport**: renderas från appens egen rapportsida via Puppeteer.
- **Konto & betalning**: Supabase-auth, Stripe-prenumeration + engångsköp,
  quota-system (gratis- och premiumkrediter) — men enanvändarmodell, inget
  mäklar-/team-koncept ännu.
- **Platsintelligens & marknadsdata**: fristående, validerade Python-motorer
  (12 platsdata-providers, flera marknadsdata-providers).
- **Bostadsinspektion**: separat modul för rum-för-rum-observationer med
  foton/dokument.

## Kända, medvetna luckor

Flera datakällor är explicit markerade som ej anslutna
(`src/lib/analysis/providers/placeholders.ts`): Lantmäteriet,
BRF-register, brottsstatistik, skolbetyg, kollektivtrafik, miljödata. Dessa
prioriteras **efter** lansering mot mäklare, inte innan — se projektplanen.

## Utveckling

Frontend: se `frontend/README.md`/`package.json` för scripts (Next.js-app).
Fristående Python-motorer (`BRF-Scraper/`, `analysis_engine/`,
`src/location_intelligence/`, `src/market_intelligence/`) har egna
beroenden/tester — se respektive mapp.
