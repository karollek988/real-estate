import type { Messages } from "../types";

/** The public pages. Same keys as ../sv/pages.ts; translate the values only. */
const pages: Messages["pages"] = {
  howItWorks: {
    meta: {
      title: "How it works",
      description:
        "From listing to decision basis: upload a screenshot of the listing, check the details and get the housing association's finances, the area and the costs in plain language.",
    },
    eyebrow: "How it works",
    title: "From listing to decision basis",
    lead: "We are on the buyer's side. We do not sell the home and we do not sell the price – we gather what decides the purchase and explain it in plain language.",
    createAnalysis: "Create analysis",
    exampleReport: "See example report",
    steps: {
      title: "Step by step",
      lead: "Creating an analysis usually takes less than a minute. {areaPromise}",
      price: "What does it cost?",
    },
    flow: {
      account: {
        title: "Create an account",
        text: "Sign up in a few seconds. Your analyses are saved on your account so that you can come back to them.",
      },
      show: {
        title: "Show us the home",
        text: "Upload one or more screenshots of the listing – from any property site – or fill in the details yourself. For an Area analysis an address is enough.",
      },
      check: {
        title: "Check the details",
        text: "We read the key details for you. You review and correct them before the analysis starts.",
      },
      report: {
        title: "Get your report",
        text: "The area, the risks and the questions for the viewing are ready in a few minutes. {reviewPromise} You get an email when it is ready.",
      },
    },
    journey: {
      title: "With you all the way",
      lead: "From the home you find to the decision you make.",
      find: { title: "Find", text: "Explore homes, buyers and swaps on the map.", cta: "To the map", note: "Preview" },
      analyse: { title: "Analyse", text: "The association's finances, the area and the costs – in plain language.", cta: "Create analysis" },
      inspect: { title: "Inspect", text: "The questions to ask and what to look for at the viewing.", cta: "Go to the Housing guide" },
      decide: { title: "Decide", text: "One overview with everything that affects the purchase.", cta: "See the example report" },
    },
  },

  pricing: {
    meta: {
      title: "Pricing",
      description:
        "Area analysis SEK {areaPrice, number}, the Peace of Mind Package SEK {packagePrice, number} per home. One-off prices including VAT – no subscriptions and no commitment period.",
    },
    eyebrow: "Pricing",
    title: "You pay once per home",
    lead: "Choose what you want to know: the area around an address, or the whole picture of the home you want to buy – the housing association's finances, the area and the costs.",
    promises: {
      oneOff: "One-off price including VAT",
      noSubscription: "No subscriptions",
      noBinding: "No commitment period",
      full: "The whole report – no locked parts",
    },
    packagesHeading: "Packages",
    compare: {
      title: "Compare what is included",
      lead: "Anyone who buys a full analysis always gets the whole report. The Area analysis is a separate, shorter report about the area around an address.",
    },
    faq: {
      title: "Questions about buying",
      description: "Payment, what is included and what happens if an analysis cannot be completed.",
    },
  },

  areas: {
    meta: {
      title: "Areas – area analysis",
      description:
        "Services, schools, commuting and safety around an address – and how the area is developing. Area analysis SEK {price, number}, ready in a few minutes.",
    },
    eyebrow: "Areas",
    title: "Get to know the area before you decide",
    lead: "The Area analysis shows what is around an address and how the area is developing. {areaPromise}",
    start: "Start an area analysis",
    explore: "Explore the map",
    compare: "Compare with the Peace of Mind Package",
    topicsTitle: "This is what the area analysis shows",
    ready: {
      title: "Ready in a few minutes",
      text: "Fully automatic, with the source of every detail stated. The housing association's finances are included in the Peace of Mind Package.",
    },
    startTitle: "Start an area analysis",
    howTo: {
      address: "Enter the street address and town, for example Storgatan 12, Stockholm.",
      cost: "The analysis is taken from your Area analyses – SEK {price, number} each.",
      ready: "The report about the area is ready in a few minutes.",
    },
    exploreLabel: "Explore further",
    map: { badge: "Preview", title: "Explore the map", text: "Homes, buyers and swaps on the map" },
    trends: { title: "Price trends and developments", text: "The policy rate, house prices and inflation in figures" },
    faq: {
      title: "Questions about the area analysis",
      description: "This is what most people wonder about the area analysis.",
    },
  },

  createAnalysis: {
    meta: {
      title: "Create analysis",
      description:
        "Upload a screenshot of the property listing, fill in the details yourself or enter an address for an area analysis – and we will put together the report.",
    },
    how: { title: "How it works", more: "Read more about how it works" },
    cost: {
      title: "What does it cost?",
      text: "The analysis is taken from your balance. If you have none left, you buy a package – once per home.",
    },
  },

  contact: {
    meta: {
      title: "Contact",
      description: "Do you have a question about Köpanalys or your analysis? Send a message or email {email}.",
    },
    title: "Contact us",
  },

  map: {
    meta: {
      title: "Map – homes, buyers and swaps",
      description:
        "Explore homes for sale, buyers who are looking and home swaps on the map. A preview of the Köpanalys map.",
    },
    title: "Map",
  },

  priceTrends: {
    meta: {
      title: "Price trends and developments in the housing market",
      description:
        "The policy rate, house prices, prices per square metre and inflation – taken directly from the Riksbank, Statistics Sweden and Svensk Mäklarstatistik.",
    },
    eyebrow: "Price trends",
    title: "Price trends and developments",
    lead: "The policy rate, house prices, prices per square metre and inflation – the figures that drive the housing market, taken directly from the Riksbank, Statistics Sweden and Svensk Mäklarstatistik.",
    meaning: {
      title: "What do the figures mean for you?",
      lead: "The market's figures explain the situation, but it is the home and the association that decide what your purchase costs.",
      policyRate: {
        title: "The policy rate",
        text: "The Riksbank's policy rate affects the banks' interest rates – both on your mortgage and on the association's loans. That is why the association's interest rate sensitivity is worth knowing about.",
        link: "Guides about the association and finances",
      },
      prices: {
        title: "House prices",
        text: "The price index shows how prices have developed overall. It says nothing about an individual home, but gives a picture of the market you are buying in.",
      },
      squareMetre: {
        title: "The price per square metre",
        text: "An average price per square metre is a guideline. What an individual home costs depends on location, condition and association.",
      },
      inflation: {
        title: "Inflation",
        text: "Inflation affects interest rates and the association's costs for things like energy and maintenance – and so the fee.",
      },
    },
    analyseArea: "Analyse an area",
    latestNews: "The latest news about the market",
  },

  news: {
    meta: {
      title: "Housing market news",
      description:
        "The latest on interest rates, house prices and decisions that affect your next home – from the Riksbank, SVT and Dagens industri.",
    },
    eyebrow: "News",
    title: "Housing market news",
    lead: "Interest rates, prices and decisions that affect your next home – the latest updates, gathered in one place.",
    moreLabel: "More to read",
    next: {
      prices: { title: "Price trends", text: "The policy rate, house prices and inflation in figures." },
      guides: { title: "The Housing guide", text: "Understand the home purchase – finances, costs, areas and risks." },
    },
  },

};

export default pages;
