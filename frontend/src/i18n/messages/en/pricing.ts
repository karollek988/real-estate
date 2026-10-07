import type { Messages } from "../types";

/** The price section and the comparison table. Same keys as ../sv/pricing.ts; translate the values only. */
const pricing: Messages["pricing"] = {
  section: {
    eyebrow: "Pricing",
    title: "Peace of mind costs SEK {price, number}",
    lead: "You pay once per home. No subscriptions and no commitment period.",
    points: {
      oneOff: "One-off price including VAT",
      full: "The whole report – no locked parts",
      refund: "If an analysis cannot be completed, you get it back",
    },
    allPrices: "See all prices and what is included",
    exampleReport: "See example report",
  },

  comparison: {
    caption: "What is included in each package",
    contents: "Contents",
    included: "Included",
    notIncluded: "Not included",
    soon: "Launching soon",
    rows: {
      homes: "Number of homes",
      area: "Area analysis: services, schools, commuting and safety",
      brf: "Housing association analysis, reviewed by our experts within 24 hours",
      property: "Property information",
      risks: "Possible risks",
      outlook: "The area's outlook",
      viewing: "Questions for the viewing and viewing guide",
      housingCost: "Housing cost calculation",
      pdf: "The report as a PDF",
    },
    homesValues: {
      omradesanalys: "1 address",
      trygghetspaket: "1 home",
      tre_bostader: "3 homes",
    },
  },
};

export default pricing;
