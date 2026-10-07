import type { Messages } from "../types";

/** The knowledge pages and the news. Same keys as ../sv/kunskap.ts; translate the values only. */
const kunskap: Messages["kunskap"] = {
  kinds: {
    guide: "Guide",
    blogg: "Blog",
  },
  readingTime: "{minutes} min read",
  read: "Read",
  swedishOnly: {
    tag: "In Swedish",
    notice: "This article is available in Swedish only.",
  },
  article: {
    published: "Published {date}",
    sources: "Sources",
    related: "Keep reading",
    createAnalysis: "Create analysis",
    exampleReport: "See the example report",
  },

  news: {
    heading: "Latest news",
    empty: {
      title: "No news could be fetched right now",
      text: "The news is fetched directly from the sources. Please try again in a moment.",
    },
    readAt: "Read at {source}",
    newTab: "(opens in a new tab)",
    footnote: "The news is fetched automatically from Sveriges Riksbank, SVT Nyheter and Dagens industri and links to the original article.",
    swedishNote: "The headlines and summaries are in Swedish, as in the original sources.",
  },
};

export default kunskap;
