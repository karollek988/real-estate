import type { Messages } from "../types";

/** The market statistics. Same keys as ../sv/insights.ts; translate the values only. */
const insights: Messages["insights"] = {
  label: "Market insights",
  eyebrow: "Market insights",
  title: "The figures that drive the market",
  description: "The same data points that underlie every analysis – taken live from the Riksbank, Statistics Sweden and Svensk Mäklarstatistik.",

  cards: {
    policyRate: { label: "Policy rate", sub: "The Riksbank, quarterly", unit: "%", source: "The Riksbank" },
    housePrices: { label: "House prices", sub: "Price index for houses, last 12 months", unit: "% / year", source: "Statistics Sweden, real estate price index" },
    pricePerSqm: { label: "Price per square metre", sub: "Tenant-owned flats, last 12 months", unit: "SEK/sq m nationwide", source: "Svensk Mäklarstatistik" },
    inflation: { label: "Inflation", sub: "CPIF, annual rate", unit: "%", source: "Statistics Sweden (CPIF)" },
  },

  sourceLine: "Source: {source}",
  sourceLineUpdated: "Source: {source} · Updated {date}",
  unavailable: "The data could not be fetched right now",

  trend: {
    unknown: "Unknown trend",
    rising: "Rising",
    falling: "Falling",
    stable: "Stable",
  },
  inflationBadge: {
    near: "Close to target",
    above: "Above target",
    below: "Below target",
  },
  percentagePoints: "pp",
  inflationTarget: "Inflation target",
  nationalAverage: "National average",

  quarter: "{year}Q{quarter}",
  months: {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "May",
    "06": "Jun",
    "07": "Jul",
    "08": "Aug",
    "09": "Sep",
    "10": "Oct",
    "11": "Nov",
    "12": "Dec",
  },
  sourceMonths: "januari,februari,mars,april,maj,juni,juli,augusti,september,oktober,november,december",
  monthsLong: "January,February,March,April,May,June,July,August,September,October,November,December",

  chartLabels: {
    policyRate: "Development of the policy rate, latest at {value} per cent",
    housePrices: "House price index (houses), latest reading {value}",
    inflation: "CPIF inflation, latest {value} per cent",
  },
};

export default insights;
