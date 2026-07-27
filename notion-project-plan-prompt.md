# Prompt att klistra in i Notion AI

Klistra in allt nedanför den här raden i Notion (t.ex. i en tom sida, med Notion AI eller "Bygg med AI") för att skapa hela projektplanen.

---

Jag driver en produkt inom PropTech (fastighets-/bostadsanalys), och vill att du bygger upp en komplett projektplan-workspace i Notion åt mig. Här är all kontext du behöver — du har ingen tidigare kunskap om projektet, så använd bara det jag skriver här.

## Om produkten

Vi bygger en tjänst som genererar analysrapporter för bostadsannonser i Sverige. Rapporten kombinerar Hemnet-annonsdata, BRF-årsredovisningar och plats-/marknadsdata (SCB, Riksbanken, Booli-jämförelseobjekt, m.m.) till en pris-, område-, risk- och förhandlingsanalys, levererad som PDF.

**Primär målgrupp: mäklare** (B2B) — mäklare ska kunna ta fram rapporter åt sina kunder som säljstöd/objektpresentation.
**Sekundär målgrupp: privatpersoner** (B2C) — köper enstaka rapporter eller en prenumeration själva.

**Slutmål: försäljning.** Detta är inte ett forskningsprojekt — allt arbete ska till slut leda till betalande mäklarkunder.

## Nuläge (vad är byggt, vad saknas)

**Byggt och fungerande end-to-end (för en enskild privatanvändare idag):**
- Hemnet-scraping med flerstegs extraktion och confidence-hantering, plus manuell inmatning som fallback
- Analysmotor: pris-, område-, marknads-, risk-, förhandlings- och BRF-analys
- Egen pipeline för att hitta och tolka BRF-årsredovisningar, med finansiell kalkylator och AI-genererad narration
- PDF-rapportgenerering
- Konto, inloggning och betalning (Stripe: prenumeration + engångsköp, quota/kreditsystem)
- Fristående, validerade motorer för plats- och marknadsintelligens (12+ datakällor: geokodning, SCB, Kolada, ränta, energipriser m.m.)
- En bostadsinspektionsmodul (rum-för-rum-observationer med foton/dokument)

**Delvis/medvetet inte anslutet ännu (lågt prioriterat före lansering):**
Flera datakällor är hedersamt markerade som "inte ansluten" snarare än fejkade: Lantmäteriet, ett heltäckande BRF-register, brottsstatistik, skolbetyg, kollektivtrafikdata, miljödata (buller/luft/översvämning). Dessa ska INTE blockera lansering — de är framtida utökningar.

**Det stora gapet mot att sälja till mäklare:** Dagens konto- och betalmodell är byggd för en enskild konsument i taget (ett konto, en quota, en prenumeration). Det finns inget mäklarkonto — ingen organisation/team-modell, inget sätt för en mäklare att hantera flera klientrapporter, ingen roll-/behörighetsmodell, ingen vitmärkning. Att bygga detta är en uttalad, hög prioritet.

## Öppna variabler som ännu INTE är spikade

Bygg in en tydlig "Beslutslogg"-sida/databas för dessa, eftersom de påverkar hela produkten och ännu inte är beslutade:
- **BRF-årsrapportering**: hur djup ska analysen vara, vilka nyckeltal ska alltid ingå, hur hanteras BRF:er utan tillgänglig rapport?
- **Prisanalys-metodik**: vilken modell/metod ska vara den "officiella" (jämförelseobjekt via Booli, statistisk modell, kombination), och hur kommuniceras osäkerhet till en mäklare som ska stå för siffrorna inför en kund?
- **Områdesanalys**: vilket djup och vilka dimensioner (skola, brott, kommunikationer, framtida byggplaner) är "measurably good enough" för lansering kontra "nice to have senare"?
- **Hemnet-scraping**: robusthet och juridisk risk vid skalning (ToS, rate-limiting, hur ofta annonser ändrar struktur) — vad är vår riskaptit och backup-plan (manuell inmatning) om scraping bryts?
- Lägg till fler rader i denna logg allteftersom nya öppna frågor dyker upp under arbetets gång.

## Vad jag vill att du bygger i Notion

1. **En "Vision & mål"-sida** som kort sammanfattar ovanstående: målgrupp (mäklare primärt, privatpersoner sekundärt), slutmål (försäljning), och nuläget i en mening.

2. **En "Nuläge"-sida** strukturerad i tre delar: Byggt / Delvis byggt (medvetet, ej blockerande) / Saknas, baserat på listorna ovan.

3. **En "Beslutslogg"-databas** för de öppna variablerna ovan, med fält: Fråga, Status (Öppen/Beslutad), Beslut, Motivering, Datum. Förifyll den med de fyra punkterna under "Öppna variabler" ovan som öppna rader.

4. **En "Milstolpar"-databas/tidslinje** mot målet "säljbar till mäklare", med dessa faser i ordning (skapa en rad per fas, med fält: Fas, Beskrivning, Status, Ägare, Beroenden, Målkriterium — dvs. vad som konkret krävs för att bocka av fasen):
   1. **Paketera befintlig analys till en mäklar-redo rapport** — kvalitetssäkra objektivitet/tonalitet i texten, lägg till vitmärkning/mäklarens varumärke på rapporten, säkerställ att rapporten håller för att visas för en mäklarens kund.
   2. **Bygg mäklarkonto** — organisation/team-modell, en mäklare kan hantera flera klientrapporter, roller (ägare/mäklare/assistent), grundläggande behörigheter.
   3. **Definiera mäklar-prismodell** — skild från dagens B2C-quota (t.ex. per rapport, kreditpaket, säteslicens/prenumeration per kontor) — inklusive vad som är lönsamt givet datakällekostnader.
   4. **Pilot med ett fåtal mäklare** — välj 3–5 pilotmäklare, samla strukturerad feedback, mät om rapporten faktiskt används i kundmöten.
   5. **Skala datakällor** — koppla in fler av dagens placeholder-källor (Lantmäteriet, skol/brotts/kollektivtrafik-data) EFTER lansering, baserat på vad piloten visar är mest efterfrågat.
   6. **Go-to-market** — säljmaterial, demo-flöde, prissättning, aktiv uppsökande försäljning mot mäklarkontor, första betalande mäklarkunder.

5. **En enkel Kanban-vy (Att göra / Pågår / Klart)** kopplad till milstolpe-databasen, så att dagligt arbete kan brytas ner under respektive fas.

Håll strukturen enkel och navigerbar — detta ska vara en levande arbetsyta jag och mitt team uppdaterar löpande, inte ett statiskt dokument.
