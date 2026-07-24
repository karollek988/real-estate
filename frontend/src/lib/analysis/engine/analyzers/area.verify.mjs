// Standalone verification for area.ts (no test framework in this
// project - see helpers.verify.mjs). Covers the three verdict buckets
// (Declining, Stable, Positive) plus the insufficient-data path.
// Run with:
//   npx tsx src/lib/analysis/engine/analyzers/area.verify.mjs
import { areaAnalyzer } from "./area.ts";

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

const baseProperty = { municipality: "Stockholm", postalCode: "11234" };
const baseSources = [
  { id: "booli_listing", name: "Booli listing", kind: "real", status: "ok", fields: [] },
  { id: "scb_area_statistics", name: "SCB area statistics", kind: "real", status: "ok", fields: [] },
];

// --- Insufficient data (both signals missing) ---
{
  const result = areaAnalyzer.analyze({
    property: { municipality: null, postalCode: null },
    extracted: { attributes: {} },
    attributes: {},
    dataSources: baseSources,
  });
  check("insufficient data - both signals null, location unverified", result.score, null);
  check("insufficient data - status", result.status, "No area data");
  check("insufficient data - confidence when unverified", result.confidence, 0.05);
}

{
  const result = areaAnalyzer.analyze({
    property: { municipality: "Stockholm", postalCode: "11234" },
    extracted: { attributes: {} },
    attributes: {},
    dataSources: baseSources,
  });
  check("insufficient data - location verified, higher confidence", result.confidence, 0.15);
}

// --- Declining (negative price trend, negative population) ---
{
  const result = areaAnalyzer.analyze({
    property: baseProperty,
    extracted: { attributes: {} },
    attributes: {
      area_sold_price_trend: [
        { period: "2024Q1", medianPricePerM2Sek: 80000, count: 10 },
        { period: "2024Q4", medianPricePerM2Sek: 72000, count: 8 },
      ],
      area_population_growth_pct: -2.5,
    },
    dataSources: baseSources,
  });
  check("declining area - score < 45 expected", result.score < 45, true);
  check("declining area - status", result.status, "Declining");
  check("declining area - score is number", typeof result.score === "number", true);
  check("declining area - confidence with price trend", result.confidence, 0.7);
}

// --- Stable (mildly positive price trend, slightly negative population) ---
{
  const result = areaAnalyzer.analyze({
    property: baseProperty,
    extracted: { attributes: {} },
    attributes: {
      area_sold_price_trend: [
        { period: "2024Q1", medianPricePerM2Sek: 75000, count: 12 },
        { period: "2024Q4", medianPricePerM2Sek: 76000, count: 10 },
      ],
      area_population_growth_pct: -0.3,
    },
    dataSources: baseSources,
  });
  check("stable area - score between 45-64", result.score >= 45 && result.score < 65, true);
  check("stable area - status", result.status, "Stable");
}

// --- Positive (strong price growth + population growth) ---
{
  const result = areaAnalyzer.analyze({
    property: baseProperty,
    extracted: { attributes: {} },
    attributes: {
      area_sold_price_trend: [
        { period: "2023Q1", medianPricePerM2Sek: 60000, count: 15 },
        { period: "2024Q4", medianPricePerM2Sek: 72000, count: 12 },
      ],
      area_population_growth_pct: 3.1,
    },
    dataSources: baseSources,
  });
  check("positive area - score >= 65", result.score >= 65, true);
  check("positive area - status", result.status, "Positive");
  check("positive area - supporting data includes both signals", "areaPriceTrendPct" in result.supportingData, true);
  check("positive area - supporting data includes population", "areaPopulationGrowthPct" in result.supportingData, true);
}

// --- Edge: only price trend (no population data) ---
{
  const result = areaAnalyzer.analyze({
    property: baseProperty,
    extracted: { attributes: {} },
    attributes: {
      area_sold_price_trend: [
        { period: "2023Q1", medianPricePerM2Sek: 50000, count: 5 },
        { period: "2024Q4", medianPricePerM2Sek: 60000, count: 7 },
      ],
    },
    dataSources: baseSources,
  });
  check("price trend only - score computed", typeof result.score === "number" && result.score !== null, true);
  check("price trend only - confidence 0.7 with trend", result.confidence, 0.7);
  check("price trend only - missingData includes scb", result.missingData.length > 0, true);
}

// --- Edge: only population data (no price trend) ---
{
  const result = areaAnalyzer.analyze({
    property: baseProperty,
    extracted: { attributes: {} },
    attributes: {
      area_population_growth_pct: 1.5,
    },
    dataSources: baseSources,
  });
  check("population only - score computed", typeof result.score === "number" && result.score !== null, true);
  check("population only - confidence 0.5 without trend", result.confidence, 0.5);
  check("population only - missingData includes booli", result.missingData.length > 0, true);
}

// --- Edge: empty trend array (trend has < 2 points, treated like null) ---
{
  const result = areaAnalyzer.analyze({
    property: baseProperty,
    extracted: { attributes: {} },
    attributes: {
      area_sold_price_trend: [{ period: "2024Q1", medianPricePerM2Sek: 75000, count: 5 }],
    },
    dataSources: baseSources,
  });
  check("single trend point - insufficient data (no signals)", result.score, null);
  check("single trend point - status is No area data", result.status, "No area data");
}

console.log(failures === 0 ? "\nAll area checks passed." : `\n${failures} area check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
