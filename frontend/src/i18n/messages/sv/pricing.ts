/**
 * The price section of the start page and the table that compares the packages on the price page. (The
 * packages' own texts - names, what each includes - are in packages.ts.)
 */
const pricing = {
  section: {
    eyebrow: "Priser",
    /** {price} is what the main package costs, in kronor. */
    title: "Tryggheten kostar {price, number} kr",
    lead: "Du betalar en gång per bostad. Inga abonnemang och ingen bindningstid.",
    points: {
      oneOff: "Engångspris inklusive moms",
      full: "Hela rapporten – inga låsta delar",
      refund: "Går en analys inte att slutföra får du tillbaka den",
    },
    allPrices: "Se alla priser och vad som ingår",
    exampleReport: "Se exempelrapport",
  },

  comparison: {
    /** Screen reader name of the table, and of its first (empty) column heading. */
    caption: "Vad som ingår i varje paket",
    contents: "Innehåll",
    /** For screen readers, in the cells that show a tick or a dash. */
    included: "Ingår",
    notIncluded: "Ingår inte",
    soon: "Lanseras snart",
    /**
     * The rows. Long words contain soft hyphens (U+00AD, written ­) where a narrow phone screen may break
     * them; in your language put them in long words too, or leave them out.
     */
    rows: {
      homes: "Antal bostäder",
      area: "Områdes­analys: service, skolor, pendling och trygghet",
      brf: "BRF-analys, granskad av våra experter inom 24 timmar",
      property: "Fastighets­information",
      risks: "Möjliga risker",
      outlook: "Framtids­utsikter för området",
      viewing: "Frågor inför visningen och visnings­guide",
      housingCost: "Boende­kalkyl",
      pdf: "Rapporten som PDF",
    },
    /** What the first row says for each package. */
    homesValues: {
      omradesanalys: "1 adress",
      trygghetspaket: "1 bostad",
      tre_bostader: "3 bostäder",
    },
  },
};

export default pricing;
