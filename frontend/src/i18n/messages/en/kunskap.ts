import type { Messages } from "../types";

/**
 * Knowledge: the Housing guide (guides), Insights and News. Same keys as ../sv/kunskap.ts; translate the values only.
 * The articles themselves are translated automatically (src/lib/translate); nothing here changes when one is added.
 */
const kunskap: Messages["kunskap"] = {
  types: {
    guide: {
      one: "Guide",
      the: "the guide",
      hub: "Housing guide",
      count: "{count, plural, one {# guide} other {# guides}}",
      read: "Read the guide",
    },
    insight: {
      one: "Insight",
      the: "the insight",
      hub: "Insights",
      count: "{count, plural, one {# insight} other {# insights}}",
      read: "Read the insight",
    },
    news: {
      one: "News",
      the: "the news item",
      hub: "News",
      count: "{count, plural, one {# news item} other {# news items}}",
      read: "Read the news item",
    },
  },

  categories: {
    "kopa-bostad": { label: "Buying a home", description: "Everything you need to know before a purchase" },
    "brf-ekonomi": { label: "Association & finances", description: "Understand the association's finances" },
    omraden: { label: "Areas", description: "Learn to compare areas" },
    risker: { label: "Risks", description: "Warning signs to watch out for" },
    kostnader: { label: "Costs", description: "Title registration, mortgage deeds and running costs" },
  },

  readingTime: "{minutes} min read",
  featuredTag: "Featured",
  published: "Published {date}",
  updated: "Updated {date}",
  moreInKnowledge: "More in Knowledge",
  knowledge: "Knowledge",

  translation: {
    notice: "Translated automatically from Swedish.",
    showOriginal: "Show the original",
    tag: "Automatic translation",
  },

  demo: {
    badge: "Example",
    hint: "Example content that is only shown during development and in preview versions – never in production.",
    banner: "Example content – only shown during development and in preview versions, never in production.",
  },

  guides: {
    meta: {
      title: "The Housing guide – understand the home purchase",
      description:
        "Guides that explain what affects a home purchase: the association's finances, debt, interest rate sensitivity, costs, areas and risks.",
      imageAlt: "Strandvägen in Stockholm",
    },
    hero: {
      eyebrow: "The Housing guide",
      title: "Understand the home purchase before you decide.",
      lead: "Clear explanations of what affects a home purchase – from the association's finances and the costs that are not in the listing to areas and risks. Written for you who want to understand, not just trust your gut feeling.",
      searchLabel: "Search the Housing guide",
      searchPlaceholder: "Search the guides, e.g. debt, title registration or interest rate",
      imageAlt: "Stone buildings and boats along Strandvägen in Stockholm on a sunny day",
      handNote: "Knowledge that gives you safer decisions.",
    },
    band: { title: "Explore guides about" },
    featuredLabel: "Featured guide",
    libraryTitle: "All guides",
    empty: {
      title: "The first guides are on their way",
      text: "We are writing guides on the association's finances, the costs around a purchase, areas and the risks to watch out for. Until they are published you can follow the market or see what an analysis shows.",
      prices: "Price trends",
      exampleReport: "See the example report",
    },
    cta: {
      imageAlt: "A cobbled street in Gamla stan in the evening sun with bicycles along the wall",
      included: { title: "In a Köpanalys", association: "The association's finances", area: "The area and how it is developing", costs: "The costs, all in one place" },
      eyebrow: "From knowledge to decision",
      title: "“I want to know how this home actually stands up.”",
      text: "The guides explain what matters. A Köpanalys shows how it looks for the particular home you are thinking about – the association's finances, the area and the costs, together in one report.",
      create: "Create analysis",
      example: "See the example report",
      handNote: "Get a personal analysis of the home you are interested in.",
    },
  },

  insights: {
    meta: {
      title: "Insights – data from the housing market",
      description: "Insights from the housing market: in-depth pieces built on data about prices, interest rates, associations and areas.",
    },
    hero: {
      eyebrow: "Insights",
      title: "Data from the housing market",
      lead: "In-depth pieces built on figures – about prices, interest rates, associations and areas. What they say, and what they mean for you who are about to buy.",
    },
    aside: {
      tag: "Updated continuously",
      title: "Price trends",
      text: "The policy rate, house prices, prices per square metre and inflation – straight from the Riksbank, Statistics Sweden and Svensk Mäklarstatistik.",
      cta: "See the figures",
    },
    featuredLabel: "Featured insight",
    libraryTitle: "All insights",
    empty: {
      title: "The first insights are on their way",
      text: "Here we collect in-depth pieces on what the figures on the housing market mean. Until then, the latest figures are under Price trends.",
      prices: "Price trends",
      guides: "The Housing guide",
    },
  },

  library: {
    filterLabel: "Filter by topic",
    all: "All",
    hits: "{count, plural, one {# result} other {# results}}",
    searchResultsFor: "Search results for <b>“{query}”</b>",
    clearSearch: "Clear the search",
    noMatch: {
      query: "Nothing matches “{query}” yet.",
      topic: "Nothing matches this topic yet.",
      text: "Try another word or another topic. We are adding more guides all the time.",
      showAll: "Show everything",
    },
  },
  search: { button: "Search" },

  article: {
    by: "By <b>{name}</b>",
    contents: "Contents",
    sections: "({count} sections)",
    empty: "The text is empty so far.",
    sidebar: {
      title: "How does the home you are looking at stand up?",
      text: "The association's finances, the area and the costs – for that particular home.",
      cta: "Create analysis",
    },
    related: "Keep reading",
    toHub: "To {hub}",
    preview: { published: "Preview · Published", draft: "Preview · Draft – not visible on the site" },
  },

  newsPage: {
    fromUs: "From Köpanalys",
  },

  news: {
    heading: "Latest news",
    empty: {
      title: "No news could be fetched right now",
      text: "The news is fetched straight from the sources. Please try again in a moment.",
    },
    readAt: "Read at {source}",
    newTab: "(opens in a new tab)",
    footnote: "The news is fetched automatically from Sveriges Riksbank, SVT Nyheter and Dagens industri and links to the original article.",
    swedishNote: "The headlines and summaries are in Swedish, just like in the original sources.",
  },
};

export default kunskap;
