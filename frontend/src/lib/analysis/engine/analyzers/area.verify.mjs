// Standalone verification for area.ts (no test framework in this project -
// see helpers.verify.mjs). The analyzer only collects facts: it must return
// the figures it found, leave out the ones it didn't, and never rate anything.
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

const sources = [{ id: "booli_listing", name: "Booli listing", kind: "real", status: "ok", fields: [] }];
const run = (property, attributes) =>
  areaAnalyzer.analyze({ property, extracted: { attributes: {} }, attributes, dataSources: sources });

// Nothing collected: not available, and nothing invented.
{
  const r = run({ municipality: null, postalCode: null }, {});
  check("no data - not available", r.available, false);
  check("no data - empty supportingData", r.supportingData, {});
  check("no score/status/weight fields", ["score", "status", "weight", "confidence"].filter((k) => k in r), []);
}

// A verified location alone is identity, not development: recorded, but not available.
{
  const r = run({ municipality: "Stockholm", postalCode: "11234" }, {});
  check("location only - not available", r.available, false);
  check("location only - recorded", r.supportingData, { municipality: "Stockholm", postalCode: "11234" });
}

// Price trend from the quarterly series (first -> last).
{
  const r = run(
    { municipality: "Stockholm", postalCode: null },
    {
      area_sold_price_trend: [
        { period: "2024Q1", medianPricePerM2Sek: 80000, count: 10 },
        { period: "2024Q2", medianPricePerM2Sek: 76000, count: 9 },
        { period: "2024Q4", medianPricePerM2Sek: 72000, count: 8 },
      ],
    }
  );
  check("trend - available", r.available, true);
  check("trend - pct", r.supportingData.areaPriceTrendPct, -10);
  check("trend - period", r.supportingData.areaPriceTrendPeriod, "2024Q1–2024Q4");
  check("trend - no population key when not collected", "areaPopulationGrowthPct" in r.supportingData, false);
}

// Population growth alone is enough to be available.
{
  const r = run({ municipality: null, postalCode: null }, { area_population_growth_pct: 1.8 });
  check("population - available", r.available, true);
  check("population - value", r.supportingData.areaPopulationGrowthPct, 1.8);
}

// A single quarter is not a trend.
{
  const r = run({ municipality: null, postalCode: null }, { area_sold_price_trend: [{ period: "2024Q4", medianPricePerM2Sek: 70000, count: 3 }] });
  check("one quarter - not a trend", r.available, false);
}

if (failures > 0) {
  console.log(`\n${failures} area check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll area checks passed.");
