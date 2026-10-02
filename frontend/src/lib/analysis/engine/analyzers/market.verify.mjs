// Standalone verification for market.ts (no test framework in this project -
// see helpers.verify.mjs). Plain figures in, plain figures out: no index, no rating.
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

const run = (attributes) => marketAnalyzer.analyze({ property: {}, extracted: { attributes: {} }, attributes, dataSources: [] });

{
  const r = run({});
  check("no data - not available", r.available, false);
  check("no data - nothing invented", r.supportingData, {});
}

{
  const r = run({
    policy_rate_change_12m_pct_points: -0.5,
    policy_rate_pct: 2.25,
    area_population_growth_pct: 0.9,
    median_income_sek_thousands: 412,
    municipality_employment_rate_pct: 81.3,
  });
  check("all figures - available", r.available, true);
  check("all figures - passed through as collected", r.supportingData, {
    policyRateChangePctPoints: -0.5,
    currentPolicyRatePct: 2.25,
    areaPopulationGrowthPct: 0.9,
    medianIncomeThousandsSek: 412,
    municipalityEmploymentRatePct: 81.3,
  });
  check("no score/status/weight fields", ["score", "status", "weight", "confidence"].filter((k) => k in r), []);
}

// The current rate is only meaningful next to its 12-month change.
{
  const r = run({ policy_rate_pct: 2.25 });
  check("rate without change - not available", r.available, false);
  check("rate without change - not recorded", "currentPolicyRatePct" in r.supportingData, false);
}

{
  const r = run({ municipality_employment_rate_pct: 78 });
  check("employment alone - available", r.available, true);
}

if (failures > 0) {
  console.log(`\n${failures} market check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll market checks passed.");
