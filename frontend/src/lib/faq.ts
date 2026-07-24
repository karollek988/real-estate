export const FAQ_ITEMS = [
  {
    question: "Vad är egentligen en Köpanalys-rapport till för?",
    answer:
      "En Köpanalys-rapport sammanställer offentlig data om en bostad till en överskådlig beslutsgrund – historiska försäljningar, föreningens ekonomi, områdesfakta, ränteläge och mer. Målet är att minska den osäkerhet som ofta följer med ett bostadsköp, så att du kan fatta ett välinformerat beslut baserat på fakta och matematik i stället för magkänsla eller en mäklares säljargument.",
  },
  {
    question: "Hur beräknas analysen?",
    answer:
      "Vi kombinerar historiska försäljningar, områdesdata, föreningens ekonomi och det aktuella marknadsläget i en statistisk modell. Varje faktor viktas och redovisas öppet i analysen, så att du ser exakt vad som driver bedömningen.",
  },
  {
    question: "Ger ni köprådgivning? Säger ni om jag ska köpa eller inte?",
    answer:
      "Nej. Köpanalys är ingen rådgivare och ger inga köprekommendationer. Rapporten visar vad verifierade uppgifter säger – den klassificerar aldrig bostaden som ett \"bra\" eller \"dåligt\" köp. Beslutet är alltid ditt.",
  },
  {
    question: "Hur träffsäkert är fair value?",
    answer:
      "Fair value är en statistisk uppskattning, inte ett facit. För de flesta bostäder ligger bedömningen inom några procent av slutpriset, och vi visar alltid osäkerhetsspannet i stället för att låtsas ha ett exakt svar.",
  },
  {
    question: "Vilka datakällor används?",
    answer:
      "Analysen bygger på en samling datakällor som omfattar offentliga register, Booli, SCB, Riksbanken, SMHI, Trafikverket och flera andra – allt från föreningars årsredovisningar och historiska transaktioner till ränte- och inflationsdata samt beslutade infrastrukturprojekt.",
  },
  {
    question: "Kan jag lita på siffrorna om jag inte hittar dem själv?",
    answer:
      "Varje datapunkt i rapporten kommer från en verifierbar källa som vi anger. Däremot uppmanar vi alltid dig som köpare att göra din egen oberoende kontroll – särskilt av föreningens ekonomi och skicket på bostaden – eftersom en analys aldrig kan ersätta en egen besiktning eller en genomgång av föreningens handlingar.",
  },
  {
    question: "Hur många gratisanalyser får jag?",
    answer:
      "Nya användare får 3 gratisanalyser direkt vid registrering. När de är förbrukade kan du fortsätta använda tjänsten via Premium – du betalar per analys eller via en månads prenumeration.",
  },
  {
    question: "Vad är skillnaden mellan gratis- och Premium-analys?",
    answer:
      "Gratisanalysen visar grundläggande bostadsfakta (adress, storlek, pris, avgift) och prisbedömningen – om priset är lågt eller högt jämfört med liknande försäljningar. Premiumanalysen innehåller allt detta plus analys av närliggande serviceutbud, infrastrukturprojekt, BRF-ekonomi i detalj och full tillgång till beslutsunderlaget.",
  },
  {
    question: "Vad kostar en Premium-analys? Hur betalar jag?",
    answer:
      "Premium-analys finns både som engångsköp och som en del av en månadsprenumeration via Stripe. Du betalar med kort – inget bindande abonnemang krävs för engångsköpet. Specifika priser visas i samband med betalningen.",
  },
  {
    question: "Vad händer om jag inte har några Premium-analyser kvar men vill se en rapport?",
    answer:
      "Analysen körs ändå och rapporten skapas, men rapporten är låst tills betalning är genomförd. Du kan då köpa en Premium-analys via Stripe för att låsa upp just den rapporten, och ditt saldo påverkas inte.",
  },
  {
    question: "Hur snabb är en analys?",
    answer:
      "En analys tar vanligen mellan 30 sekunder och 2 minuter, beroende på hur mycket offentlig data som behöver hämtas in.",
  },
  {
    question: "Vilka bostadstyper stöds?",
    answer:
      "Lägenheter (bostadsrätter), villor, radhus, parhus, kedjehus, fritidshus, tomter och gårdar. Just nu stöds endast länkar från Hemnet av typen /bostad/... – inte andra bostadssajter eller nybyggnationsprojekt.",
  },
  {
    question: "Var kommer datan ifrån?",
    answer:
      "Datan hämtas från ett antal offentliga och kommersiella källor – bland annat Booli, SCB, Riksbanken, SMHI, Trafikverket, Lantmäteriet via geokodning, samt OpenStreetMap för områdesdata. Varje källa redovisas i rapporten med källhänvisning.",
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
    question: "Hur avbokar eller avslutar jag mitt konto?",
    answer:
      "En eventuell prenumeration säger du upp via dashboardens inställningar. För att helt ta bort ditt konto och alla dina sparade uppgifter, kontakta oss via länken nedan så hjälper vi dig.",
  },
];
