// Standalone verification for risk.ts (no test framework in this project -
// see helpers.verify.mjs). Each risk fact is recorded as collected; nothing is
// weighted or combined into a risk level.
// Run with:
//   npx tsx src/lib/analysis/engine/analyzers/risk.verify.mjs
import { riskAnalyzer } from "./risk.ts";

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

const run = (attributes) => riskAnalyzer.analyze({ property: {}, extracted: { attributes: {} }, attributes, dataSources: [] });
const thisYear = new Date().getFullYear();

{
  const r = run({});
  check("no data - not available", r.available, false);
  check("no data - nothing invented", r.supportingData, {});
}

{
  const r = run({
    building_year: 1962,
    renovation_year: 2004,
    policy_rate_pct: 2.25,
    area_population_growth_pct: -0.4,
    grocery_count_within_1000m: 1,
    transit_count_within_1000m: 3,
    highway_major_count_within_1000m: 2,
  });
  check("all facts - available", r.available, true);
  check("all facts - recorded as collected", r.supportingData, {
    buildingYear: 1962,
    buildingAgeYears: thisYear - 1962,
    renovationYear: 2004,
    policyRatePct: 2.25,
    areaPopulationGrowthPct: -0.4,
    amenityCounts: { grocery: 1, transit: 3 },
    highwayProximity: 2,
  });
  check("no score/status/weight fields", ["score", "status", "weight", "confidence"].filter((k) => k in r), []);
}

// A renovation year without a building year says nothing about age.
{
  const r = run({ renovation_year: 2004 });
  check("renovation without building year - not recorded", r.supportingData, {});
}

// Service counts need both figures to be compared.
{
  const r = run({ grocery_count_within_1000m: 4 });
  check("one service count - not recorded", "amenityCounts" in r.supportingData, false);
}

if (failures > 0) {
  console.log(`\n${failures} risk check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll risk checks passed.");
