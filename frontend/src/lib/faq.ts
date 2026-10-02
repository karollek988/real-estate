import {
  OMRADESANALYS_PRICE_SEK,
  TRE_BOSTADER_COUNT,
  TRE_BOSTADER_PRICE_SEK,
  TRYGGHETSPAKET_PRICE_SEK,
} from "@/lib/pricing";

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
    question: "Vad kostar en analys? Hur betalar jag?",
    answer:
      `En Områdesanalys kostar ${OMRADESANALYS_PRICE_SEK} kr. Trygghetspaketet – den fullständiga analysen av en bostad med BRF-analys, områdesanalys och dolda kostnader – kostar ${TRYGGHETSPAKET_PRICE_SEK} kr per bostad. Vill du analysera tre bostäder kostar paketet för tre bostäder ${TRE_BOSTADER_PRICE_SEK} kr (${Math.round(TRE_BOSTADER_PRICE_SEK / TRE_BOSTADER_COUNT)} kr per bostad). Alla priser är engångsbetalningar inklusive moms, och du betalar med kort via Stripe. Vi har inga abonnemang.`,
  },
  {
    question: "Vad ingår i en Områdesanalys?",
    answer:
      "Områdesanalysen är en egen analys av området runt en adress: service, skolor och pendling nära bostaden, trygghet och samhällsdata samt hur befolkning och priser utvecklas. Du får en rapport om området och inget annat – bostadens pris, föreningens ekonomi och riskerna ingår i Trygghetspaketet.",
  },
  {
    question: "Vad ingår i Trygghetspaketet?",
    answer:
      "Trygghetspaketet är den fullständiga analysen av en bostad. Den som skapar en hel analys får alltid tillgång till hela rapporten: fastighetsinformation, boendekalkyl med jämförbara sålda bostäder och prisutveckling, områdesanalys, föreningens ekonomi, möjliga risker att undersöka vidare, investeringsutsikt och en samlad helhetsbild.",
  },
  {
    question: "Vad händer om jag inte har någon analys kvar?",
    answer:
      "Då körs ingen analys och inget dras från dig. Köp en Områdesanalys eller ett Trygghetspaket i butiken så kan du fortsätta. Går en analys inte att slutföra, till exempel för att vi inte kan hämta tillräckligt med uppgifter om en adress, får du tillbaka din analys automatiskt.",
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
    question: "Används AI i analysen?",
    answer:
      "I begränsad omfattning. En AI-språkmodell (OpenAI) driver vår chattassistent och används även för att tolka innehållet i mäklarens dokument och BRF-årsredovisningar, till exempel för att sammanfatta ett besiktningsprotokoll. AI:n används aldrig för att sätta ett betyg eller en poäng på bostaden – Köpanalys bedömer inte om en bostad är ett \"bra\" eller \"dåligt\" köp. Den sammanställer och sammanfattar bara sakuppgifter som redan finns i de faktiska dokumenten.",
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
      "Har du ett äldre abonnemang säger du upp det under Köp & saldo i dashboarden. För att helt ta bort ditt konto och alla dina sparade uppgifter, kontakta oss via länken nedan så hjälper vi dig.",
  },
];
