import type { Messages } from "../types";

/** The store. Same keys as ../sv/buy.ts; translate the values only. */
const buy: Messages["buy"] = {
  checkout: {
    success: "Your purchase went through! Your balance is updated and ready to use.",
    cancel: "The payment was cancelled. Nothing was charged to your card — please try again.",
  },

  hero: {
    title: "The map is free. <accent>Peace of mind</accent> costs SEK {price, number}.",
    text: "Buying a home is often the biggest thing you do. The Peace of Mind Package shows what the listing does not: what the housing association's finances look like, what the area looks like and what the home costs to own. If you only want to see the area around a home, an Area analysis for SEK {areaPrice, number} is enough.",
    pills: {
      oneOff: "One-off purchase – no subscription",
      vat: "All prices include VAT",
      secure: "Secure payment via Stripe",
    },
  },

  free: { label: "Free · coming soon", text: "Map with listings and communication" },
  paid: { label: "Paid", text: "Area analysis or Peace of Mind Package for those who are buying" },

  choose: {
    title: "Choose a package",
    text: "All prices are one-off payments including VAT.",
  },

  card: {
    priceNote: "{note} · one-off purchase",
    creating: "Creating payment...",
    error: "Could not create the payment.",
    genericError: "Something went wrong. Please try again.",
  },
  discount: {
    ask: "Do you have a discount code?",
    label: "Discount code",
    placeholder: "KOP-XXXXX-XXXXX",
  },

  contents: {
    title: "This is what you get in the Peace of Mind Package",
    text: "Three analyses of a home, answering the three questions that are hardest to see in a listing.",
    brf: {
      name: "Housing association analysis",
      question: "Is the association financially stable?",
      points: {
        debt: "Debt, savings and interest rate sensitivity in plain language",
        meaning: "What the association's finances mean for you in kronor",
        plans: "Pipe replacement, ground rent and planned fee increases",
        review: "Reviewed by our experts — ready within 24 hours",
      },
    },
    area: {
      name: "Area analysis",
      question: "What does the area look like?",
      points: {
        services: "Services, schools and commuting near the home",
        safety: "Safety and community data for the area",
        development: "How prices and population are developing",
        automatic: "Automatic — ready straight away",
      },
    },
    hidden: {
      name: "Hidden costs",
      question: "What does it cost to own the home?",
      points: {
        loans: "Your share of the association's loans and how the fee is affected by interest rates",
        calc: "Housing cost calculation: monthly cost and fees on purchase",
        calcSoon: "Housing cost calculation with the monthly cost and fees on purchase — launching soon",
      },
    },
    compare: {
      label: "For comparison",
      price: "A house inspection costs around SEK {price, number}.",
      text: "The Peace of Mind Package costs SEK {packagePrice, number} and does not replace an inspection. You get answers to your questions about the association, the area and the costs before you place a bid.",
      source: "Inspection price: Anticimex, villa, 2026.",
    },
  },

  steps: {
    title: "How it works",
    pay: { title: "Pay once", text: "You pay by card. No commitment period and no subscription." },
    enter: {
      title: "Enter the home",
      text: "Upload a screenshot of the listing for a Peace of Mind Package, or enter an address for an Area analysis.",
    },
    receive: {
      title: "Get your analysis",
      text: "{areaPromise} {reviewPromise} The report can be downloaded as a PDF.",
    },
  },

  footnote:
    "Prices apply to one-off purchases and are stated in Swedish kronor including VAT. {priceFootnote} The analysis is a decision basis and does not replace a survey or your own review of the association's documents.",

  payment: {
    title: "Secure & encrypted payment",
    label: "Payment methods",
  },
};

export default buy;
