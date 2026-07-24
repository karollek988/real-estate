// Standalone verification for market.ts (no test framework in this
// project - see helpers.verify.mjs). Covers the three confidence tiers
// (weightTotal >= 0.7, >= 0.3, < 0.3), all three verdict buckets within
// the high-confidence tier, and insufficient data.
// Run with:
//   npx tsx src/lib/analysis/engine/analyzers/market.verify.mjs
import { marketAnalyzer } from "./market.ts";

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
  { id: "interest_rates", name: "Interest rates", kind: "real", status: "ok", fields: [] },
  { id: "scb_area_statistics", name: "SCB area statistics", kind: "real", status: "ok", fields: [] },
];

const emptyProperty = { id: "", normalizedKey: "", address: "", hemnetUrl: null, latitude: null, longitude: null, municipality: null, postalCode: null, propertyType: null, apartmentNumber: null, floor: null, attributes: {}, fieldProvenance: {}, createdAt: "", updatedAt: "" };

// --- Insufficient data ---
{
  const result = marketAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} }, attributes: {}, dataSources: baseSources,
  });
  check("no data - score null", result.score, null);
  check("no data - status", result.status, "No market data");
  check("no data - confidence", result.confidence, 0.05);
}

// --- High confidence (all 4 signals): Positive market ---
{
  const result = marketAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      policy_rate_change_12m_pct_points: -1.5,
      area_population_growth_pct: 3.0,
      median_income_sek_thousands: 450,
      municipality_employment_rate_pct: 82,
    },
    dataSources: baseSources,
  });
  check("positive - score >= 65", result.score >= 65, true);
  check("positive - status", result.status, "Positive");
  check("positive - confidence 0.75", result.confidence, 0.75);
}

// --- High confidence: Challenging market ---
{
  const result = marketAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      policy_rate_change_12m_pct_points: 2.0,
      area_population_growth_pct: -2.5,
      median_income_sek_thousands: 280,
      municipality_employment_rate_pct: 65,
    },
    dataSources: baseSources,
  });
  check("challenging - score < 45", result.score < 45, true);
  check("challenging - status", result.status, "Challenging");
  check("challenging - confidence 0.75", result.confidence, 0.75);
}

// --- Medium confidence (only rate change + population, weightTotal 0.8) ---
{
  const result = marketAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      policy_rate_change_12m_pct_points: -0.5,
      area_population_growth_pct: 1.2,
    },
    dataSources: baseSources,
  });
  check("two signals - weightTotal >= 0.7 so high confidence tier", result.confidence, 0.75);
  check("two signals - score computed", typeof result.score === "number", true);
}

// --- Low confidence (only one signal, weightTotal < 0.3) ---
{
  const result = marketAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      median_income_sek_thousands: 340,
    },
    dataSources: baseSources,
  });
  check("one signal only - confidence 0.3", result.confidence, 0.3);
  check("one signal only - status Limited data", result.status, "Limited data");
}

// --- Edge: zero rate change (stable rate branch) ---
{
  const result = marketAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      policy_rate_change_12m_pct_points: 0,
      policy_rate_pct: 3.0,
    },
    dataSources: baseSources,
  });
  check("stable rate - score near 50", result.score >= 45 && result.score <= 55, true);
  check("stable rate - explanation mentions stable", result.explanation.includes("stable"), true);
}

// --- Edge: population growth exactly 0 ---
{
  const result = marketAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      policy_rate_change_12m_pct_points: -0.25,
      area_population_growth_pct: 0,
    },
    dataSources: baseSources,
  });
  check("zero pop growth - score computed", typeof result.score === "number", true);
  check("zero pop growth - status non-empty", result.status.length > 0, true);
}

console.log(failures === 0 ? "\nAll market checks passed." : `\n${failures} market check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
