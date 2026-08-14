# Plan: migrering från Hemnet-scraping till laglig datainhämtning

**Status:** Draft, 2026-08-13. Scraping förblir aktivt under tiden — enda
användare är projektägaren, ingen betalande kund exponeras för
scraping-baserad data. Målet är att ha en fullt laglig datapipeline innan
fler kunder tas in.

Se `docs/data-source-inventory.md` för fullständig källkatalog och
verifierade licensvillkor per källa. Den här planen beskriver *vägen dit*,
inte källorna själva.

---

## 1. Varför nu

Hemnets användarvillkor förbjuder uttryckligen scraping **och** förbjuder
uttryckligen användning av Hemnet-data för ML/AI. Det är inte en gråzon —
risken är inte primärt juridisk (småskalig scraping leder sällan till
stämning), utan operationell: IP-blockering/detektering kan slå ut
produkten utan förvarning, och att koppla betalande kunder till
scraping-baserad data ökar spårbarheten avsevärt jämfört med anonym
enanvändar-scraping.

## 2. Nuvarande beroende av scraping (vad som måste ersättas)

Från `hemnetExtract/*` (apollo.ts/jsonld.ts/semanticHtml.ts) och
`hemnetPage.ts`:

| Fält | Ersättningskälla när laglig | Täckning |
|---|---|---|
| Pris, avgift, driftkostnad, boarea, tillägg, tomtarea, rum, våning, byggår | Booli API v2 (`booli.ts`, redan implementerad) | Hög — Booli speglar de flesta Hemnet-annonser |
| Sålda priser, jämförbara objekt, områdesprisutveckling | Booli API v2 `/sold` | Hög — bättre än vad Hemnets egen sida ens visar |
| BRF-namn, ekonomi, skuld/m², underhållsplan | Bolagsverket (öppna data) | Hög, men saknar egen provider idag — se §4 |
| Energiklass | **Saknas i Booli.** Boverkets energideklarationsregister (ej ansluten idag) | Gap — se §4 |
| Beskrivningstext, mäklarnamn, bilder, planritning | **Saknas i alla lagliga API:er vi har tillgång till idag** | Permanent gap, se §5 |

`parseBotBooli.ts` räknas INTE som en laglig ersättning — det är en
tredjeparts scraping av booli.se, samma riskkategori som att scrapa Hemnet
själv, bara outsourcad. Den bör stängas av eller omklassificeras som
"scraping" i providerregistret innan lansering, inte som "real".

## 3. Faser

### Fas 0 — Nu till nästa vecka (pågår)
- Scraping förblir aktivt, endast för projektägarens egen användning.
- Skicka uppföljning till Booli om kommersiella villkor (se mailutkast).
- Skicka förfrågningar till Allabrf.se och Svensk Mäklarstatistik om
  betald/kommersiell API-åtkomst (se mailutkast).
- Registrera för Bolagsverkets "värdefulla datamängder"-API (gratis,
  självbetjäning, ingen mail behövs).

### Fas 1 — Bolagsverket-provider (kan börja oavsett Booli-svar)
- Bygg en direkt `bolagsverketProvider` i `providers/` som hämtar
  BRF-årsredovisningar via organisationsnummer, oberoende av
  Hemnet/Allabrf-upptäckt.
- Detta är den enskilt högst värderade legala källan (se tidigare analys:
  BRF-skuld/underhållsplan är starkare investeringssignal än
  marknadsföringstext) och kräver inget godkännande att vänta på.
- Problem att lösa: dagens `brfAcquisitionProvider` hittar BRF:en *via*
  Hemnet-sidan (namn/länk). Utan Hemnet-scraping behövs en annan väg att
  gå från adress → organisationsnummer. Kandidater: Bolagsverkets egen
  sökfunktion på föreningsnamn (om det finns i den lagliga Booli-datan),
  eller be användaren ange BRF-namn manuellt vid analys av en adress utan
  Hemnet-URL.

### Fas 2 — Booli som primär källa
- Beroende på svar från Booli: antingen kommersiellt avtal (om det krävs)
  eller bekräftelse att free-tier-klausulen inte träffar den här
  användningen.
- Om Booli säger nej/för dyrt: utvärdera om Svensk Mäklarstatistik eller
  Allabrf kan täcka gapet för sålda priser/områdesstatistik istället.
- Städa `parseBotBooli.ts` ur "real"-kategorin i registret.

### Fas 3 — Hantera det permanenta gapet (beskrivning, bilder, mäklare, energiklass)
- Energiklass: koppla på Boverkets energideklarationsregister direkt
  (adress-baserad slagning, ingen mailkontakt behövs — offentligt
  register).
- Beskrivning/bilder/mäklarnamn: sannolikt inte lösbart lagligt utan ett
  avtal med Hemnet eller mäklarkedjorna direkt. Två realistiska vägar:
  1. Deep-link till originalannonsen istället för att återge innehållet
     (juridiskt säkert, men sämre UX — kräver att kunden klickar sig
     vidare för bilder).
  2. Undersök om Hemnets *broker*-integrations-API (som redan finns för
     mäklare att publicera annonser) går att vända till läsåtkomst — osäkert,
     men värt en förfrågan direkt till Hemnet om ett kommersiellt
     datapartnerskap (separat från deras scraping-förbud).
- Detta är inte blockerande för lansering — produktens kärnvärde
  (pris/avgift/area/skuld/jämförbara sålda priser) klaras av fas 1+2.

### Fas 4 — Beslutspunkt: öppna för fler kunder
- Villkor för att gå vidare: scraping avstängt för alla kundflöden,
  Booli/Bolagsverket-pipeline verifierad på minst X test-adresser med
  samma träffsäkerhet som dagens scraping-baserade rapporter.
- Tills dess: scraping kvar som intern verifieringskälla (jämföra
  scraped vs. laglig data för kvalitetskontroll), aldrig kundfacing.

## 4. Öppna beslut som kräver ditt svar, inte kod

- Om Booli säger nej till kommersiell användning på rimliga villkor —
  vilken datakälla ersätter sålda-pris-jämförelser? (Mäklarstatistik
  kräver troligen partneravtal; Allabrf har sälj-data men är också
  kommersiellt licensierad.)
- Hur mycket UX-försämring är acceptabel för fas 3-gapet (ingen bild,
  ingen mäklarkontakt, ingen fri beskrivningstext) kontra att vänta på
  ett Hemnet-partnerskap som kan ta lång tid eller aldrig komma?

## 5. Sammanfattning av vad som INTE är löst av denna plan

Bilder, planritning, mäklarens namn/kontaktuppgifter och fri
beskrivningstext finns inte i någon laglig källa vi har identifierat
idag. Om produkten ska kunna visa dessa utan scraping krävs antingen ett
kommersiellt datapartnerskap med Hemnet/mäklarkedjor, eller att produkten
medvetet avstår från att återge dem och istället länkar till originalet.
