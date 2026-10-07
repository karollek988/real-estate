/**
 * The frequently asked questions: shown on the start page, the price page, the contact page and the area
 * page, and read by the chat assistant, which answers from exactly these texts. Keep every answer true to
 * what the product does today.
 *
 * The questions are listed in `items` by an id that never changes (the code picks questions by it). In an
 * answer, {areaPrice}, {packagePrice}, {bundlePrice} and {perHome} are prices in kronor filled in by the
 * code: keep them, and write the currency the way your language does.
 */
const faq = {
  /** The small label above the heading. */
  eyebrow: "FAQ",
  /** The defaults for the heading and the text under it; a page may bring its own. */
  title: "Vanliga frågor",
  description: "Det här undrar de flesta innan de skapar sin första analys.",
  /** The link at the bottom of the heading column. */
  contact: "Hittar du inte svaret? Kontakta oss",
  /** The button that shows the rest of the questions. {count} is how many there are in all. */
  showAll: "Visa alla frågor ({count})",

  items: {
    "vad-ar-kopanalys": {
      question: "Vad är Köpanalys?",
      answer:
        "Köpanalys är en oberoende granskning av bostaden du vill köpa. Rapporten samlar det som är relevant för ett bostadsköp på ett ställe: föreningens ekonomi i klartext, området, möjliga risker och frågorna att ställa till mäklaren och föreningen. Vi säljer inte bostaden och inte priset – vi ger dig underlaget så att du vet vad du köper.",
    },
    "hur-fungerar-det": {
      question: "Hur fungerar en bostadsanalys?",
      answer:
        "Du laddar upp en eller flera skärmdumpar av annonsen – från vilken bostadssajt som helst – eller fyller i uppgifterna själv. Vi läser av de viktigaste uppgifterna och du kontrollerar dem. Sedan hämtar vi data om området, föreningen och kostnaderna från flera källor och samlar allt i en rapport. Områdesdelen och de automatiska delarna är klara på några minuter; föreningens ekonomi granskas av en person och läggs till inom 24 timmar.",
    },
    datakallor: {
      question: "Vilka data använder ni?",
      answer:
        "Föreningens ekonomi kommer från föreningens egen årsredovisning. Områdesdata och marknadsdata hämtas från bland annat Booli, SCB, Riksbanken, SMHI, Trafikverket, Skolverket, Polisen och Kolada, Lantmäteriet via geokodning samt OpenStreetMap. Varje källa redovisas i rapporten.",
    },
    "hur-saker": {
      question: "Hur säker är analysen?",
      answer:
        "Varje uppgift i rapporten kommer från en källa som vi anger, och föreningens nyckeltal kontrolleras av en person mot årsredovisningen innan de visas. Rapporten ersätter ändå inte en besiktning eller en egen genomgång av föreningens handlingar – se den som underlaget inför dina egna frågor.",
    },
    pris: {
      question: "Vad kostar en analys? Hur betalar jag?",
      answer:
        "En Områdesanalys kostar {areaPrice, number} kr. Trygghetspaketet – den fullständiga analysen av en bostad med BRF-analys, områdesanalys och dolda kostnader – kostar {packagePrice, number} kr per bostad. Vill du analysera tre bostäder kostar paketet för tre bostäder {bundlePrice, number} kr ({perHome, number} kr per bostad). Alla priser är engångsbetalningar inklusive moms, och du betalar med kort via Stripe. Vi har inga abonnemang.",
    },
    "vilka-bostader": {
      question: "Kan jag analysera vilken bostad som helst?",
      answer:
        "Du kan analysera bostäder i Sverige: lägenheter (bostadsrätter), villor, radhus, parhus, kedjehus och fritidshus. Du lägger in bostaden genom att ladda upp skärmdumpar av annonsen eller genom att fylla i uppgifterna själv. BRF-analysen gäller bostäder som ingår i en bostadsrättsförening.",
    },
    "vad-ingar": {
      question: "Vad ingår i rapporten?",
      answer:
        "Trygghetspaketet är den fullständiga analysen av en bostad: BRF-analysen (granskad av våra experter inom 24 timmar), områdesanalysen, fastighetsinformationen, möjliga risker, framtidsutsikter för området, frågor inför visningen och visningsguiden. Boendekalkylen lanseras inom kort. Den som köper en hel analys får alltid tillgång till hela rapporten.",
    },
    "hur-lang-tid": {
      question: "Hur lång tid tar analysen?",
      answer:
        "Områdesanalysen och de automatiska delarna av Trygghetspaketet är oftast klara inom ett par minuter. BRF-analysen granskas av en person och är klar inom 24 timmar – du får ett mejl när den är publicerad i din rapport.",
    },
    "innan-visning": {
      question: "Kan jag använda Köpanalys innan visning?",
      answer:
        "Ja, det är då rapporten gör mest nytta. Den innehåller frågorna att ställa till mäklaren och föreningen, och i Trygghetspaketet ingår en visningsguide med det du bör titta efter på plats.",
    },
    "maklare-besiktning": {
      question: "Är Köpanalys en ersättning för mäklare eller besiktningsman?",
      answer:
        "Nej. Mäklaren anlitas av säljaren, och en besiktning undersöker husets skick på plats – det gör inte Köpanalys. Vi samlar och förklarar det som är svårt att se själv: föreningens ekonomi, området och kostnaderna. Se rapporten som ett komplement till besiktningen och till dina frågor till mäklaren.",
    },
    "vem-granskar-brf": {
      question: "Vem granskar BRF-analysen?",
      answer:
        "En av Köpanalys experter. Vår analysmotor läser av nyckeltalen i föreningens årsredovisning, och en person kontrollerar varje siffra mot årsredovisningen, fyller i det som saknas och skriver en kommentar innan analysen publiceras i din rapport. BRF-analysen är klar inom 24 timmar från köpet, och du får ett mejl när den är klar. Övriga delar av rapporten – till exempel området och riskerna – är automatiska och klara direkt.",
    },
    arsredovisning: {
      question: "Måste jag ladda upp föreningens årsredovisning själv?",
      answer:
        "Nej. Har du den (du får den oftast av mäklaren eller föreningen) kan du ladda upp den i rapporten, så går granskningen snabbare. Annars tar vi fram den åt dig.",
    },
    "bra-eller-daliga-siffror": {
      question: "Hur vet ni vilka siffror som är bra eller dåliga?",
      answer:
        "Vi jämför varje nyckeltal med de nivåer som banker och bostadsorganisationer – bland annat SBAB, HSB och Handelsbanken – brukar ange som låga och höga, och med snittet bland svenska föreningar enligt Nabos analys av 2 250 årsredovisningar. Nyckeltalen är de som alla bostadsrättsföreningar måste redovisa sedan 2023. Det är jämförelser, inget betyg på föreningen.",
    },
    radgivning: {
      question: "Ger ni köprådgivning? Säger ni om jag ska köpa eller inte?",
      answer:
        'Nej. Köpanalys är ingen rådgivare och ger inga köprekommendationer. Rapporten visar vad uppgifterna säger och vad de betyder för dig – den klassificerar aldrig bostaden som ett "bra" eller "dåligt" köp. Beslutet är alltid ditt.',
    },
    boendekalkyl: {
      question: "Vad är boendekalkylen?",
      answer:
        "Boendekalkylen visar vad bostaden kostar dig på riktigt: avgift, ränta och amortering varje månad, och engångskostnader som lagfart och pantbrev. Den håller på att färdigställas och lanseras inom kort. Redan nu visar BRF-analysen kostnader som är lätta att missa, till exempel din del av föreningens lån och hur avgiften påverkas om räntan stiger.",
    },
    omradesanalys: {
      question: "Vad ingår i en Områdesanalys?",
      answer:
        "Områdesanalysen är en egen analys av området runt en adress: service, skolor och pendling nära bostaden, trygghet och samhällsdata samt hur befolkning och priser utvecklas. Den är automatisk och klar på några minuter. Du får en rapport om området och inget annat – föreningens ekonomi och riskerna ingår i Trygghetspaketet.",
    },
    "ingen-analys-kvar": {
      question: "Vad händer om jag inte har någon analys kvar?",
      answer:
        "Då körs ingen analys och inget dras från dig. Köp en Områdesanalys eller ett Trygghetspaket så kan du fortsätta. Går en analys inte att slutföra, till exempel för att vi inte kan hämta tillräckligt med uppgifter om en adress, får du tillbaka din analys automatiskt.",
    },
    ai: {
      question: "Används AI i analysen?",
      answer:
        'I begränsad omfattning. Chattassistenten drivs av en AI-språkmodell (OpenAI). Nyckeltalen i årsredovisningen läses av automatiskt av vår analysmotor och kontrolleras sedan av en person på Köpanalys. Ingen AI sätter betyg eller poäng på bostaden – Köpanalys bedömer inte om en bostad är ett "bra" eller "dåligt" köp.',
    },
    sokhistorik: {
      question: "Sparar ni min sökhistorik och mina analyser?",
      answer:
        "Ja – dina analysförfrågningar (vilka bostäder du har tittat på och när) sparas på ditt konto så att du kan se din historik på dashboarden. Själva analysdatan bakom är delad och cachad per bostad, inte personlig. Du kan läsa mer om dina uppgifter på dashboardens Sekretess-sida.",
    },
    pdf: {
      question: "Kan jag ladda ner rapporten som PDF?",
      answer:
        'Ja – varje färdig rapport har en "Ladda ner PDF"-knapp så att du enkelt kan spara eller dela den. Rapporten är också fullt läsbar direkt i webbläsaren på dator och mobil.',
    },
    "avsluta-konto": {
      question: "Hur avbokar eller avslutar jag mitt konto?",
      answer:
        "Har du ett äldre abonnemang säger du upp det under Köp & saldo i dashboarden. För att helt ta bort ditt konto och alla dina sparade uppgifter, kontakta oss via länken nedan så hjälper vi dig.",
    },
  },
};

export default faq;
