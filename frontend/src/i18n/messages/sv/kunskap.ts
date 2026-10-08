/**
 * Kunskap: Bostadsguiden (guides), Insikter (insights) and Nyheter (news), the pages and the words around the
 * articles - labels, buttons, reading time, the hubs' headings, the search and the filter.
 *
 * The articles themselves (title, summary, text) are written by the editor in /admin/content in Swedish. On a page
 * in another language they are translated automatically when they are first asked for (src/lib/translate) and the
 * page says so (`translation`). Nothing here has to be changed when an article is added.
 *
 * `types` and `categories` name the kinds of article and the five subjects of Bostadsguiden. The categories' short
 * names (the slugs: "brf-ekonomi") are fixed in src/lib/content/model.ts and are not translated.
 */
const kunskap = {
  /** The three kinds of article. one/the/hub are used in running text ("Läs guiden", "Till Bostadsguiden"). */
  types: {
    guide: {
      one: "Guide",
      the: "guiden",
      hub: "Bostadsguiden",
      /** "6 guider", "1 guide". */
      count: "{count, plural, one {# guide} other {# guider}}",
      read: "Läs guiden",
    },
    insight: {
      one: "Insikt",
      the: "insikten",
      hub: "Insikter",
      count: "{count, plural, one {# insikt} other {# insikter}}",
      read: "Läs insikten",
    },
    news: {
      one: "Nyhet",
      the: "nyheten",
      hub: "Nyheter",
      count: "{count, plural, one {# nyhet} other {# nyheter}}",
      read: "Läs nyheten",
    },
  },

  /** The five subjects of Bostadsguiden. */
  categories: {
    "kopa-bostad": { label: "Köpa bostad", description: "Allt du behöver veta inför ett köp" },
    "brf-ekonomi": { label: "BRF & ekonomi", description: "Förstå föreningens ekonomi" },
    omraden: { label: "Områden", description: "Lär dig jämföra områden" },
    risker: { label: "Risker", description: "Varningssignaler att se upp med" },
    kostnader: { label: "Kostnader", description: "Lagfart, pantbrev och löpande utgifter" },
  },

  /** {minutes} is the reading time in minutes. */
  readingTime: "{minutes} min läsning",
  /** A tag on a card for the item a hub leads with. */
  featuredTag: "Utvald",
  /** {date} is a date written in the reader's language. */
  published: "Publicerad {date}",
  updated: "Uppdaterad {date}",
  /** Screen reader name of the two links to the other hubs. */
  moreInKnowledge: "Mer i Kunskap",
  knowledge: "Kunskap",

  /** Shown on an article that has been translated automatically from Swedish. */
  translation: {
    /** A note above the article. */
    notice: "Översatt automatiskt från svenska.",
    /** The link to the same article in Swedish. */
    showOriginal: "Visa originalet",
    /** A short tag on a card. */
    tag: "Automatisk översättning",
  },

  /** Temporary development content (never shown in production). */
  demo: {
    badge: "Exempel",
    hint: "Exempelinnehåll som bara visas under utveckling och i förhandsversioner – aldrig i produktion.",
    banner: "Exempelinnehåll – visas bara under utveckling och i förhandsversioner, aldrig i produktion.",
  },

  /** /bostadsguider */
  guides: {
    meta: {
      title: "Bostadsguiden – förstå bostadsköpet",
      description:
        "Guider som förklarar det som påverkar ett bostadsköp: föreningens ekonomi, skuldsättning, räntekänslighet, kostnader, områden och risker.",
      imageAlt: "Strandvägen i Stockholm",
    },
    hero: {
      eyebrow: "Bostadsguiden",
      title: "Förstå bostadsköpet innan du bestämmer dig.",
      lead: "Tydliga förklaringar av det som påverkar ett bostadsköp – från föreningens ekonomi och kostnaderna som inte står i annonsen till områden och risker. Skrivet för dig som vill förstå, inte bara lita på magkänslan.",
      searchLabel: "Sök i Bostadsguiden",
      searchPlaceholder: "Sök bland guider, t.ex. skuldsättning, lagfart eller ränta",
      imageAlt: "Stenhus och båtar längs Strandvägen i Stockholm en solig dag",
      handNote: "Kunskap som ger dig tryggare beslut.",
    },
    band: { title: "Utforska guider inom" },
    featuredLabel: "Utvald guide",
    libraryTitle: "Alla guider",
    empty: {
      title: "De första guiderna är på väg",
      text: "Vi skriver just nu guider om föreningens ekonomi, kostnaderna runt ett köp, områden och riskerna att se upp med. Tills de är publicerade kan du följa marknaden eller se vad en analys visar.",
      prices: "Prisutveckling",
      exampleReport: "Se exempelrapport",
    },
    /** The closing call to action of Bostadsguiden and of every guide. */
    cta: {
      imageAlt: "Kullerstensgata i Gamla stan i kvällssol med cyklar längs husväggen",
      included: { title: "I en Köpanalys", association: "Föreningens ekonomi", area: "Området och dess utveckling", costs: "Kostnaderna samlade" },
      eyebrow: "Från kunskap till beslut",
      title: "”Jag vill veta hur den här bostaden faktiskt står sig.”",
      text: "Guiderna förklarar vad som spelar roll. En Köpanalys visar hur det ser ut för just den bostad du funderar på – föreningens ekonomi, området och kostnaderna, samlat i en rapport.",
      create: "Skapa analys",
      example: "Se exempelrapport",
      handNote: "Få en personlig analys av bostaden du är intresserad av.",
    },
  },

  /** /insikter */
  insights: {
    meta: {
      title: "Insikter – data från bostadsmarknaden",
      description: "Insikter från bostadsmarknaden: fördjupningar byggda på data om priser, räntor, föreningar och områden.",
    },
    hero: {
      eyebrow: "Insikter",
      title: "Data från bostadsmarknaden",
      lead: "Fördjupningar byggda på siffror – om priser, räntor, föreningar och områden. Vad de säger, och vad de betyder för dig som ska köpa.",
    },
    aside: {
      tag: "Uppdateras löpande",
      title: "Prisutveckling och trender",
      text: "Styrränta, bostadspriser, kvadratmeterpriser och inflation – direkt från Riksbanken, SCB och Svensk Mäklarstatistik.",
      cta: "Se siffrorna",
    },
    featuredLabel: "Utvald insikt",
    libraryTitle: "Alla insikter",
    empty: {
      title: "De första insikterna är på väg",
      text: "Här samlar vi fördjupningar om vad siffrorna på bostadsmarknaden betyder. Tills dess finns de senaste siffrorna under Prisutveckling.",
      prices: "Prisutveckling",
      guides: "Bostadsguiden",
    },
  },

  /** The list with the filter, the search results and the count (the hubs). */
  library: {
    filterLabel: "Filtrera efter ämne",
    all: "Alla",
    /** The count while a filter or a search is active. */
    hits: "{count, plural, one {# träff} other {# träffar}}",
    searchResultsFor: "Sökresultat för <b>”{query}”</b>",
    clearSearch: "Rensa sökningen",
    noMatch: {
      query: "Inget matchar ”{query}” ännu.",
      topic: "Inget matchar det här ämnet ännu.",
      text: "Prova ett annat ord eller ett annat ämne. Vi fyller på med fler guider löpande.",
      showAll: "Visa allt",
    },
  },
  search: { button: "Sök" },

  /** An article page. {name} is the author. */
  article: {
    by: "Av <b>{name}</b>",
    contents: "Innehåll",
    /** {count} is the number of headings. */
    sections: "({count} avsnitt)",
    empty: "Texten är tom ännu.",
    sidebar: {
      title: "Hur står sig bostaden du tittar på?",
      text: "Föreningens ekonomi, området och kostnaderna – för just den bostaden.",
      cta: "Skapa analys",
    },
    related: "Läs vidare",
    /** {hub} is the name of the hub: "Bostadsguiden". */
    toHub: "Till {hub}",
    /** The banner above the editor's preview of an item. */
    preview: { published: "Förhandsgranskning · Publicerad", draft: "Förhandsgranskning · Utkast – syns inte på sajten" },
  },

  /** The news page: our own news above the feed, and where to go next. */
  newsPage: {
    fromUs: "Från Köpanalys",
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
