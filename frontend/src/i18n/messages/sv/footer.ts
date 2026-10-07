/** The footer at the bottom of every page: the four link columns, the contact details and the legal line. */
const footer = {
  /** Screen reader name of the logo link. Keep the brand name. */
  homeLabel: "Köpanalys – till startsidan",
  tagline: "Köpa bostad? Vi visar vad du faktiskt köper – föreningens ekonomi, området och alla kostnader.",
  facebookLabel: "Köpanalys på Facebook",
  instagramLabel: "Köpanalys på Instagram",

  /** The four columns. `title` is the column's heading (and the screen reader name of its navigation). */
  columns: {
    company: {
      title: "Köpanalys",
      saFungerarDet: "Så fungerar det",
      exempelrapport: "Exempelrapport",
      kontakt: "Kontakt",
    },
    analysis: {
      title: "Bostadsanalys",
      karta: "Karta",
      skapaAnalys: "Skapa analys",
      omraden: "Områden",
      prisutveckling: "Prisutveckling",
      priser: "Priser",
    },
    knowledge: {
      title: "Kunskap",
      blogg: "Blogg",
      nyheter: "Nyheter",
      guider: "Guider",
    },
    support: {
      title: "Support",
      faq: "Vanliga frågor",
      konto: "Mitt konto",
      kop: "Köp analyser",
    },
  },

  /** The line at the very bottom. {year} is the current year and {orgNumber} the company's registration number: keep both. */
  copyright: "© {year} Köpanalys. Org.nr {orgNumber}",
  legal: {
    privacy: "Integritetspolicy",
    terms: "Användarvillkor",
  },
};

export default footer;
