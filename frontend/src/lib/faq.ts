export const FAQ_ITEMS = [
  {
    question: "Vad är egentligen en Köpanalys-rapport till för?",
    answer:
      "En Köpanalys-rapport sammanställer offentlig data om en bostad till en överskådlig beslutsgrund – historiska försäljningar, föreningens ekonomi, områdesfakta, ränteläge och mer. Målet är att minska den osäkerhet som ofta följer med ett bostadsköp, så att du kan fatta ett välinformerat beslut baserat på fakta och matematik i stället för magkänsla eller en mäklares säljargument.",
  },
  {
    question: "Varför ska jag använda Köpanalys istället för vanlig AI?",
    answer:
      "Du kan visst klistra in en skärmdump från Hemnet i ChatGPT eller Claude och få ett svar som låter självsäkert – men det blir en bedömning baserad på bilden och modellens allmänna kunskap, inte en verifierad analys. Köpanalys är byggt specifikt för bostadsanalys: skärmdumpen blir strukturerad bostadsdata som körs genom samma analysmotor för alla – prisanalys, områdesanalys, BRF-analys, möjliga risker och investeringsprognos – där varje datapunkt kommer från en namngiven extern källa (till exempel Booli, SCB, Riksbanken, SMHI och Trafikverket) i stället för modellens egen \"kunskap\". Saknas data sägs det rakt ut i stället för att gissas ihop. Du får en samlad rapport i stället för ett löst chattsvar, kan komplettera den med föreningens årsredovisning och ladda ner den som PDF – sådant du annars hade fått leta upp, bedöma tillförlitligheten på och sammanställa själv för hand.",
  },
  {
    question: "Ger ni köprådgivning, eller är Köpanalys ett beslutsunderlag?",
    answer:
      "Ett beslutsunderlag – inte rådgivning. Köpanalys är ingen finansiell rådgivare och ger inga köprekommendationer eller investeringsråd. Rapporten visar vad verifierade uppgifter säger och organiserar dem åt dig, men klassificerar aldrig bostaden som ett \"bra\" eller \"dåligt\" köp. Beslutet är alltid ditt.",
  },
  {
    question: "Hur beräknas analysen?",
    answer:
      "Vi kombinerar historiska försäljningar, områdesdata, föreningens ekonomi och det aktuella marknadsläget i en statistisk modell. Varje faktor viktas och redovisas öppet i analysen, så att du ser exakt vad som driver bedömningen.",
  },
  {
    question: "Hur träffsäkert är fair value?",
    answer:
      "Fair value är en statistisk uppskattning, inte ett facit. För de flesta bostäder ligger bedömningen inom några procent av slutpriset, och vi visar alltid osäkerhetsspannet i stället för att låtsas ha ett exakt svar.",
  },
  {
    question: "Vilka datakällor används, och var kommer datan ifrån?",
    answer:
      "Analysen bygger på en kombination av offentliga och kommersiella källor: Booli, SCB, Riksbanken, SMHI, Trafikverket och OpenStreetMap, Lantmäteriet för geokodning, samt föreningars egna årsredovisningar och historiska transaktioner. Varje datapunkt i rapporten är märkt med sin källa, så du ser exakt varifrån en uppgift kommer i stället för att behöva ta den på förtroende.",
  },
  {
    question: "Kan jag lita på siffrorna om jag inte hittar dem själv?",
    answer:
      "Varje datapunkt i rapporten kommer från en verifierbar källa som vi anger. Däremot uppmanar vi alltid dig som köpare att göra din egen oberoende kontroll – särskilt av föreningens ekonomi och skicket på bostaden – eftersom en analys aldrig kan ersätta en egen besiktning eller en genomgång av föreningens handlingar.",
  },
  {
    question: "Vad händer om uppgifter saknas eller är fel i min rapport?",
    answer:
      "Vi gissar aldrig för att fylla en lucka. Saknas en uppgift, eller går den inte att verifiera mot någon av våra källor, visas den som \"Uppgift saknas\" i rapporten i stället för en påhittad siffra. Ett fåtal datakällor (till exempel viss miljödata och kommunala planärenden) är i dagsläget inte anslutna alls, vilket i så fall framgår tydligt i rapporten. Ser du en uppgift som verkar fel, till exempel för att mäklaren ändrat annonsen efter din analys, hör av dig till oss så tittar vi på det – och för föreningens ekonomi kan du själv ladda upp en nyare årsredovisning för att uppdatera den delen av analysen direkt.",
  },
  {
    question: "Används AI i analysen?",
    answer:
      "I begränsad omfattning. En AI-språkmodell (OpenAI) driver vår chattassistent och används även för att tolka och sammanfatta innehållet i BRF-årsredovisningar, till exempel föreningens lån och underhållsplan. AI:n används aldrig för att sätta ett betyg eller en poäng på bostaden – Köpanalys bedömer inte om en bostad är ett \"bra\" eller \"dåligt\" köp – och skärmdumpen du laddar upp läses av med vanlig, deterministisk texttolkning (OCR) snarare än AI-bildtolkning. AI:n sammanställer och sammanfattar bara sakuppgifter som redan finns i de faktiska dokumenten.",
  },
  {
    question: "Vilka bostadstyper och bostadssajter stöds?",
    answer:
      "Lägenheter (bostadsrätter), villor, radhus, parhus, kedjehus, fritidshus, tomter och gårdar. Du lägger in bostaden genom att ladda upp en eller flera skärmdumpar av annonsen – det fungerar oavsett vilken bostadssajt annonsen kommer från, eftersom vi läser av bilden i stället för att hämta sidan automatiskt – eller genom att fylla i uppgifterna manuellt om du hellre gör det. Nyproduktion och projekt utan slutpris kan vara svårare att bedöma träffsäkert, eftersom de saknar jämförbara historiska försäljningar.",
  },
  {
    question: "Hur snabb är en analys?",
    answer:
      "En analys tar vanligen mellan 30 sekunder och 2 minuter, beroende på hur mycket offentlig data som behöver hämtas in.",
  },
  {
    question: "Hur kompletterar jag analysen med fler dokument, till exempel en nyare årsredovisning?",
    answer:
      "Om föreningen har publicerat en nyare årsredovisning än den vi hittat automatiskt kan du ladda upp den själv (PDF, Word eller bild) – antingen direkt på rapportens BRF-kapitel eller från din dashboard. Vi läser av dokumentet och kör om analysen med de nya siffrorna. Det kostar ingen extra kredit och påverkar inte ditt saldo.",
  },
  {
    question: "Hur fungerar krediter och gratisanalyser på mitt konto?",
    answer:
      "Nya konton får 3 gratisanalyser direkt vid registrering, utan att några kortuppgifter krävs. När de är förbrukade fortsätter du med Premium-analyser – antingen styckvis, eller som en del av en månadsprenumeration med ett större antal analyser ingående. Ditt aktuella saldo och vilket alternativ som passar dig ser du alltid under Prenumerationer på din dashboard.",
  },
  {
    question: "Vad är skillnaden mellan gratis- och Premium-analys?",
    answer:
      "Gratisanalysen visar grundläggande bostadsfakta (adress, storlek, pris, avgift, bilder) samt kapitlen Prisanalys och Bostadsrättsförening – prisbedömning mot områdets medianpris och föreningens ekonomiska nyckeltal. Premiumanalysen låser upp resten av rapporten: jämförbara sålda bostäder och historisk prisutveckling, områdesanalys, möjliga risker värda att undersöka vidare, investeringsutsikt och en samlad helhetsbild.",
  },
  {
    question: "Vad kostar en Premium-analys? Hur betalar jag?",
    answer:
      "Premium-analys finns både som engångsköp och som en del av en månadsprenumeration, betalning sköts säkert via Stripe. Du betalar med kort eller Klarna – inget bindande abonnemang krävs för engångsköpet, och en prenumeration kan avslutas när du vill. Specifika priser visas i samband med betalningen och under Prenumerationer på din dashboard.",
  },
  {
    question: "Vad händer om jag inte har några Premium-analyser kvar men vill se en rapport?",
    answer:
      "Analysen körs ändå och rapporten skapas, men rapporten är låst tills betalning är genomförd. Du kan då köpa en Premium-analys via Stripe för att låsa upp just den rapporten, och ditt saldo påverkas inte.",
  },
  {
    question: "Vad händer om analysen misslyckas, eller jag betalat men inte fått en fungerande rapport?",
    answer:
      "Om vi inte lyckas hämta in tillräckligt tillförlitlig data om bostaden markeras analysen som misslyckad i stället för att visa en rapport vi inte litar på – och krediten återförs då automatiskt till ditt konto, så du inte förlorar den. Det här är den vanligaste orsaken, och det gäller både gratis- och Premium-analyser. I det mer sällsynta fallet att något annat gick tekniskt fel ber vi dig höra av dig till oss på info@kopanalys.se, så löser vi det – till exempel genom att köra om analysen eller reda ut vad som hänt med din kredit. Vi lovar inte en generell återbetalning av pengarna, men du blir aldrig sittande med en trasig rapport utan att vi tittar på det.",
  },
  {
    question: "Sparar ni min sökhistorik och mina analyser?",
    answer:
      "Ja – dina analysförfrågningar (vilka bostäder du har tittat på och när) sparas på ditt konto så att du kan se din historik på dashboarden. Själva analysdatan bakom är delad och cachad per bostad, inte personlig. Du kan läsa mer om dina uppgifter på dashboardens Sekretess-sida.",
  },
  {
    question: "Kan jag ladda ner rapporten som PDF?",
    answer:
      "Ja – varje färdig rapport har en \"Ladda ner PDF\"-knapp så att du enkelt kan spara eller dela den. Rapporten är förstås också fullt läsbar direkt i webbläsaren på dator och mobil.",
  },
  {
    question: "Hur avslutar jag min prenumeration eller raderar mitt konto?",
    answer:
      "Båda delarna gör du själv, utan att behöva kontakta oss. En prenumeration hanterar och avslutar du under Prenumerationer på din dashboard, som öppnar Stripes betalningsportal. Vill du radera hela ditt konto gör du det under Inställningar – det tar permanent bort ditt konto, dina analyser och sparade bostäder (delade BRF-årsredovisningar och marknadsdata, som är gemensamma för alla användare, påverkas inte). Båda är permanenta åtgärder som inte går att ångra.",
  },
  {
    question: "Hur kontaktar jag support?",
    answer:
      "Enklast är kontaktformuläret längst ner på sidan, eller ett mejl direkt till info@kopanalys.se. Vi har i dagsläget ingen chatt eller telefonsupport, men vi återkommer på mejl så snart vi kan – oavsett om det gäller ett tekniskt problem, en fråga om en rapport eller ditt konto, din prenumeration eller dina krediter.",
  },
];
