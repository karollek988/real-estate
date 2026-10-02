// Standalone verification for housingAssociation.ts (no test framework in this
// project - see helpers.verify.mjs). This is the AUTOMATIC reading of an
// uploaded annual report (the Python engine's metrics) — internal data and the
// reviewer's starting point; customers only ever see the person-reviewed BRF
// analysis (lib/brf/, lib/report/brfChapter.ts). It must reshape what the
// engine returned and never rate anything.
// Run with:
//   npx tsx src/lib/analysis/engine/analyzers/housingAssociation.verify.mjs
import { housingAssociationAnalyzer } from "./housingAssociation.ts";

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

const field = (value) => ({ value, unit: "", formula: "", inputs: [], inputValues: [], computed: value !== null });
const METRIC_KEYS = [
  "debtPerApartment", "equityPerApartment", "revenuePerApartment", "costPerApartment", "equityRatio", "debtRatio",
  "operatingMargin", "interestCoverage", "costPerSqm", "feeSustainability", "totalDebt", "weightedAverageInterest",
  "shortTermDebtRatio", "interestCostPerApartment", "debtToEquity", "liquidityMonths",
];
function analysis(values, findings = [], signals = []) {
  const metrics = { fiscalYear: 2024 };
  for (const key of METRIC_KEYS) metrics[key] = key in values ? field(values[key]) : null;
  return { status: "ok", metrics, reasoning: { signals, observations: [], findings, recommendations: [], overallConfidence: 0.8 } };
}
const run = (attributes) => housingAssociationAnalyzer.analyze({ property: {}, extracted: { attributes: {} }, attributes, dataSources: [] });

// No annual report uploaded.
{
  const r = run({ housing_association: "Brf Solbacken" });
  check("none - not available", r.available, false);
  check("none - name and state recorded", r.supportingData, { housingAssociation: "Brf Solbacken", reportState: "none" });
}

// Uploaded and read, but nothing passed verification.
{
  const r = run({ brf_financial_analysis: analysis({ equityRatio: null, totalDebt: null }) });
  check("unusable - not available", r.available, false);
  check("unusable - state", r.supportingData.reportState, "unusable");
}

// Verified figures and the engine's findings pass straight through.
{
  const r = run({
    housing_association: "Brf Solbacken",
    brf_financial_analysis: analysis(
      { equityRatio: 0.42, totalDebt: 18000000, liquidityMonths: 7 },
      [{ dimension: "debt_sustainability", classification: "weakness", severity: "moderate", summary: "Hög skuld per lägenhet", confidence: 0.9, signalMetrics: [] }],
      [{ metric: "equity_ratio", value: 0.42, strength: "positive", thresholdDescription: "", confidence: 0.9 }]
    ),
    brf_annual_report: { apartment_metrics: { number_of_rental: { value: 3 }, parking_spaces: { value: 12 } } },
  });
  check("verified - available", r.available, true);
  check("verified - state", r.supportingData.reportState, "verified");
  check("verified - fiscal year", r.supportingData.fiscalYear, 2024);
  check("verified - figures", [r.supportingData.equityRatio, r.supportingData.totalDebt, r.supportingData.liquidityMonths], [0.42, 18000000, 7]);
  check("verified - missing metric stays null", r.supportingData.operatingMargin, null);
  check("verified - findings reshaped", r.supportingData.findings, [
    { dimension: "debt_sustainability", classification: "weakness", severity: "moderate", summary: "Hög skuld per lägenhet" },
  ]);
  check("verified - apartment facts from the report", [r.supportingData.numberOfRentalApartments, r.supportingData.parkingSpaces], [3, 12]);
  check("no score/status/weight fields", ["score", "status", "weight", "confidence"].filter((k) => k in r), []);
}

if (failures > 0) {
  console.log(`\n${failures} housingAssociation check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll housingAssociation checks passed.");
