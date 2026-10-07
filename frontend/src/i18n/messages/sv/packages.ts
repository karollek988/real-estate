/**
 * What Köpanalys sells, worded once for every page that shows it - the price section on the start page, the
 * price page, the store, the FAQ and the chat assistant. The prices themselves are numbers kept in the code
 * (src/lib/pricing.ts); a text gets them as {price}, {perProperty} and {saving}, and writes the number with
 * {price, number} so that each language gets its own digit grouping. Write the currency as your readers do
 * ("499 kr", "SEK 499").
 *
 * Product names used in these files: Områdesanalys (a stand-alone analysis of the area around an address),
 * Trygghetspaketet (the complete analysis of one home) and "Tre bostäder" (the same for three homes).
 */
const packages = {
  /** The one part of the report that a person reviews before the customer sees it. */
  reviewPromise: "BRF-analysen granskas av våra experter innan du får den och är klar inom 24 timmar.",
  areaPromise: "Områdesanalysen är automatisk och klar på några minuter.",
  /** Under the packages. "Anticimex" is a company name. */
  priceFootnote: "Besiktningspriset är Anticimex pris för villa 2026. Alla priser inkl. moms.",

  /** The price as written in a package card: <n> is the big number, <u> the small currency. Move them as your language writes prices. */
  priceTag: "<n>{price, number}</n> <u>kr</u>",
  /** The price in the short list of the other packages: the number with the currency under it. */
  priceTagStacked: "<n>{price, number}</n><u>kr</u>",
  /** The price in the heading of a column of the comparison table. */
  priceInline: "{price, number} kr",

  items: {
    omradesanalys: {
      name: "Områdesanalys",
      /** The name in a narrow table heading: add soft hyphens (U+00AD) where a long word may break. */
      tableName: "Områdes­analys",
      /** What the price covers: shown after the price, "499 kr · en bostad". */
      priceNote: "området runt en bostad",
      summary: "Automatisk analys av området runt en bostad.",
      includes: {
        services: "Service, skolor och resor",
        safety: "Trygghet och samhällsdata",
        development: "Hur området utvecklas",
        instant: "Klar direkt",
      },
      cta: "Köp Områdesanalys",
    },
    trygghetspaket: {
      name: "Trygghetspaketet",
      tableName: "Trygghets­paketet",
      priceNote: "en bostad",
      summary: "Tre djupanalyser av en bostad: BRF, området och dolda kostnader.",
      includes: {
        brf: "BRF-analys, granskad av våra experter inom 24 timmar",
        area: "Områdesanalys",
        hiddenCosts: "Dolda kostnader",
        hiddenCostsSoon: "Dolda kostnader (boendekalkyl lanseras snart)",
        questions: "Frågor till mäklaren och föreningen",
      },
      /** {price} is what a house inspection costs, according to Anticimex. */
      valueNote: "Till jämförelse: en husbesiktning kostar runt {price, number} kr",
      /** The green tag on the main package. */
      badge: "Huvudpaket",
      cta: "Köp Trygghetspaketet",
    },
    tre_bostader: {
      name: "Tre bostäder",
      tableName: "Tre bostäder",
      priceNote: "tre bostäder",
      summary: "Trygghetspaketet för tre bostäder, för dig som budar på flera.",
      includes: {
        package: "Trygghetspaketet för tre bostäder",
        each: "BRF, område och dolda kostnader för varje",
      },
      valueNote: "{perProperty, number} kr per bostad · du sparar {saving, number} kr",
      cta: "Köp tre bostäder",
    },
  },
};

export default packages;
