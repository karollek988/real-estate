// Standalone verification for negotiation.ts (no test framework in this
// project - see helpers.verify.mjs). Covers the four verdict buckets (Low,
// Limited, Moderate, Strong potential), the insufficient-data paths, and
// edge cases like a very fresh listing or missing dates.
// Run with:
//   npx tsx src/lib/analysis/engine/analyzers/negotiation.verify.mjs
import { negotiationAnalyzer } from "./negotiation.ts";

let failures = 0;
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}`);
  if (!pass) {
    failures++;
    console.log("  expected:", JSON.stringify(expected));
    console.log("  actual:  ", JSON.stringify(actual));
  }
}

const baseSources = [
  { id: "hemnet_page_scrape", name: "Hemnet page scrape", kind: "real", status: "ok", fields: [] },
  { id: "interest_rates", name: "Interest rates", kind: "real", status: "ok", fields: [] },
  { id: "scb_area_statistics", name: "SCB area statistics", kind: "real", status: "ok", fields: [] },
];

const emptyProperty = { id: "", normalizedKey: "", address: "", hemnetUrl: null, latitude: null, longitude: null, municipality: null, postalCode: null, propertyType: null, apartmentNumber: null, floor: null, attributes: {}, fieldProvenance: {}, createdAt: "", updatedAt: "" };

// Helper: date string N days ago
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// --- Insufficient data (no listingDate, askingPrice, or currentRate) ---
{
  const result = negotiationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} }, attributes: {}, dataSources: baseSources,
  });
  check("no data - score null", result.score, null);
  check("no data - status", result.status, "No negotiation data");
}

// --- Strong potential (long DOM, high rate, declining pop, expensive vs income) ---
{
  const result = negotiationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      listing_date: daysAgo(120),
      asking_price_sek: 6_000_000,
      living_area_m2: 60,
      median_income_sek_thousands: 280,
      policy_rate_pct: 4.5,
      area_population_growth_pct: -2.0,
    },
    dataSources: baseSources,
  });
  check("strong potential - score >= 70", result.score >= 70, true);
  check("strong potential - status", result.status, "Strong potential");
}

// --- Low/Limited potential (fresh listing, affordable, low rate, growing pop) ---
// DOM 2d → score 30, price/income ratio ~4.17 → score ~53, rate 1% → score 37, pop 3% → score 30
// Weighted: 30*0.4 + 53*0.25 + 37*0.2 + 30*0.15 = 35.65 → score 36, status "Limited potential" (35-49)
{
  const result = negotiationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      listing_date: daysAgo(2),
      asking_price_sek: 2_000_000,
      living_area_m2: 80,
      median_income_sek_thousands: 480,
      policy_rate_pct: 1.0,
      area_population_growth_pct: 3.0,
    },
    dataSources: baseSources,
  });
  check("low buying power - score between 30-49", result.score >= 30 && result.score < 50, true);
  check("low buying power - status Limited or Low", ["Limited potential", "Low potential"].includes(result.status), true);
}

// --- Edge: no listing_date (missing date, only other signals) ---
{
  const result = negotiationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      asking_price_sek: 4_000_000,
      living_area_m2: 70,
      median_income_sek_thousands: 350,
      policy_rate_pct: 3.0,
      area_population_growth_pct: -0.5,
    },
    dataSources: baseSources,
  });
  check("no listing date - score computed from other signals", typeof result.score === "number", true);
  check("no listing date - status non-empty", result.status.length > 0, true);
}

// --- Edge: only listing_date (DOM 30 → score 60, status Moderate potential) ---
{
  const result = negotiationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      listing_date: daysAgo(30),
    },
    dataSources: baseSources,
  });
  check("only listing date - score 60 (DOM 30-44 days)", result.score >= 55 && result.score <= 65, true);
  check("only listing date - status Moderate potential", ["Moderate potential", "Limited potential"].includes(result.status), true);
}

// --- Edge: listing_date is today (daysOnMarket === 0, signal skipped) ---
{
  const result = negotiationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      listing_date: daysAgo(0),
      policy_rate_pct: 3.0,
    },
    dataSources: baseSources,
  });
  check("listed today - score computed from rate signal", typeof result.score === "number", true);
}

// --- Moderate potential (moderate DOM, balanced rate) ---
{
  const result = negotiationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      listing_date: daysAgo(45),
      policy_rate_pct: 2.5,
    },
    dataSources: baseSources,
  });
  check("moderate - score between 35-69", result.score >= 35 && result.score < 70, true);
  check("moderate - status", result.status, "Moderate potential");
}

console.log(failures === 0 ? "\nAll negotiation checks passed." : `\n${failures} negotiation check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
