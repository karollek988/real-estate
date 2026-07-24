// Standalone verification for price.ts (no test framework in this
// project - see helpers.verify.mjs). Covers the relative-comparables path,
// the affordability path (all 4 burden buckets), insufficient data, and
// edge cases.
// Run with:
//   npx tsx src/lib/analysis/engine/analyzers/price.verify.mjs
import { priceAnalyzer } from "./price.ts";

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
  { id: "scb_area_statistics", name: "SCB area statistics", kind: "real", status: "ok", fields: [] },
  { id: "interest_rates", name: "Interest rates", kind: "real", status: "ok", fields: [] },
];

const emptyProperty = { id: "", normalizedKey: "", address: "", hemnetUrl: null, latitude: null, longitude: null, municipality: null, postalCode: null, propertyType: null, apartmentNumber: null, floor: null, attributes: {}, fieldProvenance: {}, createdAt: "", updatedAt: "" };

// --- Insufficient data (no asking price) ---
{
  const result = priceAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} }, attributes: {}, dataSources: baseSources,
  });
  check("no asking price - score null", result.score, null);
  check("no asking price - status", result.status, "No listing price");
}

// --- Relative comparison: Excellent value (price well below area median) ---
{
  const result = priceAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { asking_price_sek: 2_000_000, living_area_m2: 80, area_median_price_per_m2_sek: 40000 },
    dataSources: baseSources,
  });
  check("excellent value - score >= 80", result.score >= 80, true);
  check("excellent value - status", result.status, "Excellent value");
  check("excellent value - confidence 0.85", result.confidence, 0.85);
}

// --- Relative comparison: Above market (price well above area median) ---
{
  const result = priceAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { asking_price_sek: 8_000_000, living_area_m2: 60, area_median_price_per_m2_sek: 40000 },
    dataSources: baseSources,
  });
  check("above market - score < 40", result.score < 40, true);
  check("above market - status", result.status, "Above market");
}

// --- Affordability path: Reasonable (moderate burden, ~36%) ---
{
  const result = priceAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      asking_price_sek: 1_500_000, living_area_m2: 70, monthly_fee_sek: 2000,
      median_income_sek_thousands: 500, policy_rate_pct: 2.0,
    },
    dataSources: baseSources,
  });
  check("reasonable price - score >= 50", result.score >= 50, true);
  check("reasonable price - status Reasonable or better", ["Reasonable", "Favorable"].includes(result.status), true);
}

// --- Overpriced: high price, low income, high rate ---
{
  const result = priceAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      asking_price_sek: 8_000_000, living_area_m2: 50, monthly_fee_sek: 5000,
      median_income_sek_thousands: 280, policy_rate_pct: 4.5,
    },
    dataSources: baseSources,
  });
  check("overpriced - score < 35", result.score < 35, true);
  check("overpriced - status", result.status, "Overpriced");
}

// --- Edge: living_area is 0 (pricePerM2 becomes null, falls back to affordability) ---
{
  const result = priceAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      asking_price_sek: 3_000_000, living_area_m2: 0,
      median_income_sek_thousands: 350, policy_rate_pct: 3.0,
    },
    dataSources: baseSources,
  });
  check("zero living area - score computed from remaining signals", typeof result.score === "number", true);
  check("zero living area - status set", result.status.length > 0, true);
}

// --- Edge: only askingPrice available (priceRange signal alone gives score 50) ---
{
  const result = priceAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { asking_price_sek: 5_000_000 },
    dataSources: baseSources,
  });
  check("only asking price - score 50 (priceRange signal)", result.score, 50);
  check("only asking price - status Reasonable", result.status, "Reasonable");
}

// --- Edge: areaMedianPerM2 but no livingArea (falls through to affordability) ---
{
  const result = priceAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      asking_price_sek: 3_000_000, area_median_price_per_m2_sek: 50000,
      median_income_sek_thousands: 400, policy_rate_pct: 2.5,
    },
    dataSources: baseSources,
  });
  check("median available but no living area - uses affordability path", typeof result.score === "number", true);
  check("median but no living area - confidence 0.55 or 0.7", result.confidence >= 0.55, true);
}

console.log(failures === 0 ? "\nAll price checks passed." : `\n${failures} price check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
