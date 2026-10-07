/**
 * The market statistics on the price page: four cards with a chart each (the policy rate, house prices, the
 * price per square metre, inflation). The numbers come live from the Riksbank, SCB and Svensk Mäklarstatistik;
 * these are the words around them.
 *
 * Numbers are written by the code in the reader's language (1,5 or 1.5), so they are not in these files.
 */
const insights = {
  /** The section's name for screen readers. */
  label: "Marknadsinsikter",
  /** Shown above the cards where the section opens a page of its own. */
  eyebrow: "Marknadsinsikter",
  title: "Siffrorna som styr marknaden",
  description: "Samma datapunkter som ligger till grund för varje analys – hämtade live från Riksbanken, SCB och Svensk Mäklarstatistik.",

  cards: {
    policyRate: { label: "Styrränta", sub: "Riksbanken, kvartalsvis", unit: "%", source: "Riksbanken" },
    housePrices: { label: "Bostadspriser", sub: "Prisindex för småhus, senaste 12 månaderna", unit: "% / år", source: "SCB Fastighetsprisindex" },
    pricePerSqm: { label: "Kvadratmeterpris", sub: "Bostadsrätter, senaste 12 månaderna", unit: "kr/kvm i riket", source: "Svensk Mäklarstatistik" },
    inflation: { label: "Inflation", sub: "KPIF, årstakt", unit: "%", source: "SCB (KPIF)" },
  },

  /** The line under a card. {source} is the name of the source and {date} when it was last updated. */
  sourceLine: "Källa: {source}",
  sourceLineUpdated: "Källa: {source} · Uppdaterad {date}",
  /** Shown in place of a chart when the numbers could not be fetched. */
  unavailable: "Data kunde inte hämtas just nu",

  /** The small tag on a card that says which way a number is moving. */
  trend: {
    unknown: "Okänd trend",
    rising: "Stigande",
    falling: "Fallande",
    stable: "Stabil",
  },
  inflationBadge: {
    near: "Nära målet",
    above: "Över målet",
    below: "Under målet",
  },
  /** "percentage points": the unit of a change in the policy rate, e.g. "+0,25 pp". */
  percentagePoints: "pp",
  /** The text on the line that marks the Riksbank's inflation target of 2 %. */
  inflationTarget: "Inflationsmål",
  /** The name of the figure for all of Sweden, in the price per square metre chart. The other names are towns. */
  nationalAverage: "Riksgenomsnitt",

  /** A quarter: "2024K3" (the third quarter of 2024). {year} and {quarter} are filled in by the code. */
  quarter: "{year}K{quarter}",
  /** The months as written on the inflation chart (and in the tooltips), by number. */
  months: {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "Maj",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Okt",
    "11": "Nov",
    "12": "Dec",
  },
  /**
   * The month names as they appear in the date that Svensk Mäklarstatistik prints ("8 juli 2026"), in the order
   * January to December, written the way the SOURCE writes them: Swedish. Used to read that date; the date is then
   * shown with `monthsLong` of the reader's language. Do not translate this list.
   */
  sourceMonths: "januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december",
  /** The same twelve months in the reader's language, written as they should be shown, separated by commas. */
  monthsLong: "januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december",

  /** What a screen reader says about a chart. {value} is the latest figure. */
  chartLabels: {
    policyRate: "Styrräntans utveckling, senaste till {value} procent",
    housePrices: "Bostadsprisindex (småhus), senaste noteringen {value}",
    inflation: "Inflationen KPIF, senaste {value} procent",
  },
};

export default insights;
