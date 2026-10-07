/**
 * The "Kunskap" pages: the words around the blog posts and guides (labels, buttons, reading time) and the
 * news page. The articles themselves - their titles and texts - are written in Swedish only and live in
 * src/lib/kunskap/articles.ts; on a page in another language they are shown in Swedish with a note.
 */
const kunskap = {
  kinds: {
    guide: "Guide",
    blogg: "Blogg",
  },
  /** {minutes} is the reading time in minutes. */
  readingTime: "{minutes} min läsning",
  /** The link at the bottom of an article card. */
  read: "Läs",
  /** Shown on a page in another language than the articles are written in. */
  swedishOnly: {
    /** A small tag on an article card. */
    tag: "På svenska",
    /** A note above an article page. */
    notice: "Den här artikeln finns bara på svenska.",
  },
  article: {
    /** {date} is the publishing date. */
    published: "Publicerad {date}",
    sources: "Källor",
    related: "Läs vidare",
    createAnalysis: "Skapa analys",
    exampleReport: "Se exempelrapporten",
  },

  news: {
    /** A heading only screen readers hear, above the news. */
    heading: "Senaste nyheterna",
    empty: {
      title: "Inga nyheter kunde hämtas just nu",
      text: "Nyheterna hämtas direkt från källorna. Försök igen om en stund.",
    },
    /** The link on a news card. {source} is the name of the publisher. */
    readAt: "Läs hos {source}",
    /** For screen readers: the link opens in a new tab. */
    newTab: "(öppnas i en ny flik)",
    footnote: "Nyheterna hämtas automatiskt från Sveriges Riksbank, SVT Nyheter och Dagens industri och länkar till originalartikeln.",
    /** Shown after the footnote on a page in another language: the news itself is in Swedish. */
    swedishNote: "Rubrikerna och sammanfattningarna är på svenska, precis som i originalkällorna.",
  },
};

export default kunskap;
