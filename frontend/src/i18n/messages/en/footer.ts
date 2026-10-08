import type { Messages } from "../types";

/** The footer at the bottom of every page. Same keys as ../sv/footer.ts; translate the values only. */
const footer: Messages["footer"] = {
  homeLabel: "Köpanalys – go to the start page",
  tagline: "Buying a home? We show you what you are actually buying – the housing association's finances, the area and all the costs.",
  facebookLabel: "Köpanalys on Facebook",
  instagramLabel: "Köpanalys on Instagram",

  columns: {
    company: {
      title: "Köpanalys",
      saFungerarDet: "How it works",
      exempelrapport: "Example report",
      kontakt: "Contact",
    },
    analysis: {
      title: "Home analysis",
      karta: "Map",
      skapaAnalys: "Create analysis",
      omraden: "Areas",
      prisutveckling: "Price trends",
      priser: "Pricing",
    },
    knowledge: {
      title: "Knowledge",
      bostadsguiden: "Housing guide",
      insikter: "Insights",
      nyheter: "News",
    },
    support: {
      title: "Support",
      faq: "Frequently asked questions",
      konto: "My account",
      kop: "Buy analyses",
    },
  },

  copyright: "© {year} Köpanalys. Org. no. {orgNumber}",
  legal: {
    privacy: "Privacy policy",
    terms: "Terms of use",
  },
};

export default footer;
