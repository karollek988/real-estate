/**
 * The start page's first two parts: the big opening ("hero") with the three steps, and the section where an
 * analysis is started (also the top of the "Skapa analys" page).
 *
 * In a text, <accent>...</accent> is shown in the brand's green and <br></br> is a line break that is only
 * used on wider screens: keep them, and move them to where the same words fall in your language.
 */
const landing = {
  hero: {
    /** The pill above the headline: three short words, shown with dots between them. */
    badge: {
      independent: "Oberoende",
      factBased: "Faktabaserad",
      safer: "För en tryggare bostadsaffär",
    },
    title: "Din oberoende partner <br></br>för <accent>bostadsanalyser</accent>",
    lead: "Vi samlar och analyserar data från flera källor för att ge dig en tydlig bild av bostäder, områden och föreningar – så att du kan fatta tryggare beslut.",
    showMap: "Visa karta",
    exampleReport: "Se exempelrapport",
    /** Description of the picture of a laptop showing the map, for screen readers. */
    laptopAlt: "Köpanalys-kartan med bostäder till salu i Stockholm, visad på en laptop",
    /** The three cards under the laptop. Each is two short lines: "Hitta" over "bostaden". */
    steps: {
      find: { title: "Hitta", subtitle: "bostaden" },
      analyse: { title: "Analysera", subtitle: "bostaden" },
      decide: { title: "Besluta", subtitle: "tryggare" },
    },
  },

  analyze: {
    eyebrow: "Bostadsanalys",
    title: "Köpa bostad? Vi visar vad du <accent>faktiskt köper</accent>.",
    lead: "En oberoende granskning av bostaden du vill köpa; föreningens ekonomi, området och alla kostnader.",
    /** The four small labels under the lead: what the package covers. */
    pills: {
      housingCost: "Boendekalkyl",
      area: "Områdesanalys",
      brf: "BRF-analys",
      risks: "Möjliga risker",
    },
    /** A small tag on a part that is not ready yet. */
    soon: "snart",
    valueProps: {
      independent: { title: "Oberoende granskning", description: "Vi står på köparens sida – inte säljarens eller mäklarens." },
      association: { title: "Föreningen i klartext", description: "Granskad av våra experter, klar inom 24 timmar." },
      area: { title: "Området direkt", description: "Service, skolor och resor – automatiskt och på några minuter." },
      questions: { title: "Frågor inför visningen", description: "Det som inte står i annonsen, samlat på ett ställe." },
    },
    trust: {
      title: "Betrodd av fastighetsinvesterare över hela Sverige",
    },
    /** The dark card where the analysis is started. */
    card: {
      title: "Analysera en bostad",
      /** The link that opens the "Så fungerar det" window. */
      howItWorks: "Hur går det till?",
      duration: "Tar vanligtvis mindre än 60 sekunder",
      /** Screen reader name of the three tabs. */
      methodsLabel: "Hur vill du ange bostaden?",
      /** `label` is the tab's name on a wide screen, `short` on a phone. */
      methods: {
        screenshot: { label: "Ladda upp skärmdump", short: "Skärmdump" },
        manual: { label: "Manuell inmatning", short: "Manuellt" },
        area: { label: "Områdesanalys", short: "Område" },
      },
      /** The tag on a tab that cannot be used yet. */
      soonBadge: "Snart",
      manualNotice:
        "Manuell inmatning är under utveckling och vi jobbar kontinuerligt med att förbättra den. Just nu kan du analysera en bostad genom att ladda upp skärmdumpar av annonsen istället.",
    },
  },
};

export default landing;
