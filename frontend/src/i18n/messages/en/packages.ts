import type { Messages } from "../types";

/** What Köpanalys sells. Same keys as ../sv/packages.ts; translate the values only. */
const packages: Messages["packages"] = {
  reviewPromise: "The housing association analysis is reviewed by our experts before you receive it and is ready within 24 hours.",
  areaPromise: "The Area analysis is automatic and ready in a few minutes.",
  priceFootnote: "The inspection price is Anticimex's price for a villa in 2026. All prices include VAT.",

  priceTag: "<u>SEK</u> <n>{price, number}</n>",
  priceTagStacked: "<u>SEK</u><n>{price, number}</n>",
  priceInline: "SEK {price, number}",

  items: {
    omradesanalys: {
      name: "Area analysis",
      tableName: "Area analysis",
      priceNote: "the area around a home",
      summary: "Automatic analysis of the area around a home.",
      includes: {
        services: "Services, schools and commuting",
        safety: "Safety and community data",
        development: "How the area is developing",
        instant: "Ready straight away",
      },
      cta: "Buy Area analysis",
    },
    trygghetspaket: {
      name: "Peace of Mind Package",
      tableName: "Peace of Mind Package",
      priceNote: "one home",
      summary: "Three in-depth analyses of a home: the housing association, the area and hidden costs.",
      includes: {
        brf: "Housing association analysis, reviewed by our experts within 24 hours",
        area: "Area analysis",
        hiddenCosts: "Hidden costs",
        hiddenCostsSoon: "Hidden costs (housing cost calculation launching soon)",
        questions: "Questions for the estate agent and the association",
      },
      valueNote: "For comparison: a house inspection costs around SEK {price, number}",
      badge: "Main package",
      cta: "Buy the Peace of Mind Package",
    },
    tre_bostader: {
      name: "Three homes",
      tableName: "Three homes",
      priceNote: "three homes",
      summary: "The Peace of Mind Package for three homes, for when you are bidding on several.",
      includes: {
        package: "The Peace of Mind Package for three homes",
        each: "Housing association, area and hidden costs for each",
      },
      valueNote: "SEK {perProperty, number} per home · you save SEK {saving, number}",
      cta: "Buy three homes",
    },
  },
};

export default packages;
