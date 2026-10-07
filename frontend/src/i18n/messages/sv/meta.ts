/**
 * What search engines and browser tabs show for the site as a whole. Each page adds its own title in front
 * (see the page's own area); this is the fallback and the ending.
 */
const meta = {
  /** The title of a page that has none of its own (the start page). */
  title: "Köpanalys – vi visar vad du faktiskt köper",
  /** The ending of every page's title: "Priser | Köpanalys". %s is the page's own title. Keep the brand name. */
  titleTemplate: "%s | Köpanalys",
  /** The description under the title in search results, for pages that have none of their own. */
  description:
    "En oberoende granskning av bostaden du vill köpa: föreningens ekonomi, området och alla kostnader. Områdesanalys 99 kr, Trygghetspaketet 499 kr.",
};

export default meta;
