import {
  OMRADESANALYS_PRICE_SEK,
  TRE_BOSTADER_COUNT,
  TRE_BOSTADER_PRICE_SEK,
  TRYGGHETSPAKET_PRICE_SEK,
} from "@/lib/pricing";

// Also the chat assistant's reference text (api/chat/route.ts) — keep every
// answer true to what the product does today.
export const FAQ_ITEMS = [
  {
    question: "Vad är en Köpanalys-rapport till för?",
    answer:
      "Rapporten samlar det som är relevant för ett bostadsköp på ett ställe: föreningens ekonomi i klartext, området, möjliga risker och frågorna att ställa till mäklaren och föreningen. Vi säljer inte bostaden och inte priset – vi ger dig underlaget så att du vet vad du köper.",
  },
  {
    question: "Vem granskar BRF-analysen?",
    answer:
      "En av Köpanalys experter. Vår analysmotor läser av nyckeltalen i föreningens årsredovisning, och en person kontrollerar varje siffra mot årsredovisningen, fyller i det som saknas och skriver en kommentar innan analysen publiceras i din rapport. BRF-analysen är klar inom 24 timmar från köpet, och du får ett mejl när den är klar. Övriga delar av rapporten – till exempel området och riskerna – är automatiska och klara direkt.",
  },
  {
    question: "Måste jag ladda upp föreningens årsredovisning själv?",
    answer:
      "Nej. Har du den (du får den oftast av mäklaren eller föreningen) kan du ladda upp den i rapporten, så går granskningen snabbare. Annars tar vi fram den åt dig.",
  },
  {
    question: "Hur vet ni vilka siffror som är bra eller dåliga?",
    answer:
      "Vi jämför varje nyckeltal med de nivåer som banker och bostadsorganisationer – bland annat SBAB, HSB och Handelsbanken – brukar ange som låga och höga, och med snittet bland svenska föreningar enligt Nabos analys av 2 250 årsredovisningar. Nyckeltalen är de som alla bostadsrättsföreningar måste redovisa sedan 2023. Det är jämförelser, inget betyg på föreningen.",
  },
  {
    question: "Ger ni köprådgivning? Säger ni om jag ska köpa eller inte?",
    answer:
      "Nej. Köpanalys är ingen rådgivare och ger inga köprekommendationer. Rapporten visar vad uppgifterna säger och vad de betyder för dig – den klassificerar aldrig bostaden som ett \"bra\" eller \"dåligt\" köp. Beslutet är alltid ditt.",
  },
  {
    question: "Vad är boendekalkylen?",
    answer:
      "Boendekalkylen visar vad bostaden kostar dig på riktigt: avgift, ränta och amortering varje månad, och engångskostnader som lagfart och pantbrev. Den håller på att färdigställas och lanseras inom kort. Redan nu visar BRF-analysen kostnader som är lätta att missa, till exempel din del av föreningens lån och hur avgiften påverkas om räntan stiger.",
  },
  {
    question: "Vad kostar en analys? Hur betalar jag?",
    answer:
      `En Områdesanalys kostar ${OMRADESANALYS_PRICE_SEK} kr. Trygghetspaketet – den fullständiga analysen av en bostad med BRF-analys, områdesanalys och dolda kostnader – kostar ${TRYGGHETSPAKET_PRICE_SEK} kr per bostad. Vill du analysera tre bostäder kostar paketet för tre bostäder ${TRE_BOSTADER_PRICE_SEK} kr (${Math.round(TRE_BOSTADER_PRICE_SEK / TRE_BOSTADER_COUNT)} kr per bostad). Alla priser är engångsbetalningar inklusive moms, och du betalar med kort via Stripe. Vi har inga abonnemang.`,
  },
  {
    question: "Vad ingår i en Områdesanalys?",
    answer:
      "Områdesanalysen är en egen analys av området runt en adress: service, skolor och pendling nära bostaden, trygghet och samhällsdata samt hur befolkning och priser utvecklas. Den är automatisk och klar på några minuter. Du får en rapport om området och inget annat – föreningens ekonomi och riskerna ingår i Trygghetspaketet.",
  },
  {
    question: "Vad ingår i Trygghetspaketet?",
    answer:
      "Trygghetspaketet är den fullständiga analysen av en bostad: BRF-analysen (granskad av våra experter inom 24 timmar), områdesanalysen, fastighetsinformationen, möjliga risker, framtidsutsikter för området, frågor inför visningen och visningsguiden. Boendekalkylen lanseras inom kort. Den som köper en hel analys får alltid tillgång till hela rapporten.",
  },
  {
    question: "Vad händer om jag inte har någon analys kvar?",
    answer:
      "Då körs ingen analys och inget dras från dig. Köp en Områdesanalys eller ett Trygghetspaket så kan du fortsätta. Går en analys inte att slutföra, till exempel för att vi inte kan hämta tillräckligt med uppgifter om en adress, får du tillbaka din analys automatiskt.",
  },
  {
    question: "Vad ingår i en Områdesanalys?",
    answer:
      "Områdesanalysen och de automatiska delarna av Trygghetspaketet är oftast klara inom ett par minuter. BRF-analysen granskas av en person och är klar inom 24 timmar – du får ett mejl när den är publicerad i din rapport.",
  },
  {
    question: "Vilka bostadstyper stöds?",
    answer:
      "Lägenheter (bostadsrätter), villor, radhus, parhus, kedjehus och fritidshus. Du lägger in bostaden genom att ladda upp skärmdumpar av annonsen eller genom att fylla i uppgifterna själv. BRF-analysen gäller bostäder som ingår i en bostadsrättsförening.",
  },
  {
    question: "Var kommer datan ifrån?",
    answer:
      "Föreningens ekonomi kommer från föreningens egen årsredovisning. Områdesdata och marknadsdata hämtas från bland annat Booli, SCB, Riksbanken, SMHI, Trafikverket, Skolverket, Polisen och Kolada, Lantmäteriet via geokodning samt OpenStreetMap. Varje källa redovisas i rapporten.",
  },
  {
    question: "Kan jag lita på siffrorna?",
    answer:
      "Varje uppgift i rapporten kommer från en källa som vi anger, och föreningens nyckeltal kontrolleras av en person mot årsredovisningen innan de visas. Rapporten ersätter ändå inte en besiktning eller en egen genomgång av föreningens handlingar – se den som underlaget inför dina egna frågor.",
  },
  {
    question: "Används AI i analysen?",
    answer:
      "I begränsad omfattning. Chattassistenten drivs av en AI-språkmodell (OpenAI). Nyckeltalen i årsredovisningen läses av automatiskt av vår analysmotor och kontrolleras sedan av en person på Köpanalys. Ingen AI sätter betyg eller poäng på bostaden – Köpanalys bedömer inte om en bostad är ett \"bra\" eller \"dåligt\" köp.",
  },
  {
    question: "Sparar ni min sökhistorik och mina analyser?",
    answer:
      "Ja – dina analysförfrågningar (vilka bostäder du har tittat på och när) sparas på ditt konto så att du kan se din historik på dashboarden. Själva analysdatan bakom är delad och cachad per bostad, inte personlig. Du kan läsa mer om dina uppgifter på dashboardens Sekretess-sida.",
  },
  {
    question: "Kan jag ladda ner rapporten som PDF?",
    answer:
      "Ja – varje färdig rapport har en \"Ladda ner PDF\"-knapp så att du enkelt kan spara eller dela den. Rapporten är också fullt läsbar direkt i webbläsaren på dator och mobil.",
  },
  {
    question: "Hur avslutar jag min prenumeration eller raderar mitt konto?",
    answer:
      "Har du ett äldre abonnemang säger du upp det under Köp & saldo i dashboarden. För att helt ta bort ditt konto och alla dina sparade uppgifter, kontakta oss via länken nedan så hjälper vi dig.",
  },
];
