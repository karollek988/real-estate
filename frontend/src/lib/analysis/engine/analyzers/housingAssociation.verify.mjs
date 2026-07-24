// Standalone verification for housingAssociation.ts (no test framework in this
// project - see helpers.verify.mjs). Covers the scoring paths (Strong/Healthy/
// Mixed/Weak/Critical finances), the insufficient_verified_data path, the
// BRF-identified path, the no-data path, and the unreachable fallback.
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

const baseSources = [
  { id: "brf_financials", name: "Housing association finances", kind: "real", status: "ok", fields: [] },
  { id: "brf_register", name: "BRF register", kind: "placeholder", status: "not_connected", fields: [] },
];

const emptyProperty = { id: "", normalizedKey: "", address: "", hemnetUrl: null, latitude: null, longitude: null, municipality: null, postalCode: null, propertyType: null, apartmentNumber: null, floor: null, attributes: {}, fieldProvenance: {}, createdAt: "", updatedAt: "" };

function makeAnalysis(overrides) {
  const base = {
    status: "ok",
    metrics: {
      fiscalYear: 2023,
      equityRatio: { value: 0.3, unit: "%", formula: "", inputs: [], inputValues: [], computed: true },
      operatingMargin: { value: 0.15, unit: "%", formula: "", inputs: [], inputValues: [], computed: true },
      debtPerApartment: { value: 200000, unit: "SEK", formula: "", inputs: [], inputValues: [], computed: true },
      feeSustainability: { value: 1.2, unit: "ratio", formula: "", inputs: [], inputValues: [], computed: true },
      liquidityMonths: { value: 6, unit: "months", formula: "", inputs: [], inputValues: [], computed: true },
      debtRatio: { value: 0.4, unit: "%", formula: "", inputs: [], inputValues: [], computed: true },
      debtToEquity: { value: 1.5, unit: "ratio", formula: "", inputs: [], inputValues: [], computed: true },
      totalDebt: { value: 50000000, unit: "SEK", formula: "", inputs: [], inputValues: [], computed: true },
      weightedAverageInterest: { value: 0.03, unit: "%", formula: "", inputs: [], inputValues: [], computed: true },
      shortTermDebtRatio: { value: 0.1, unit: "%", formula: "", inputs: [], inputValues: [], computed: true },
      costPerSqm: { value: 1500, unit: "SEK", formula: "", inputs: [], inputValues: [], computed: true },
      equityPerApartment: null,
      revenuePerApartment: null,
      costPerApartment: null,
      interestCoverage: null,
      interestCostPerApartment: null,
    },
    reasoning: {
      signals: [],
      observations: [],
      findings: [],
      recommendations: [],
      overallConfidence: 0.85,
    },
  };
  if (overrides) {
    if (overrides.reasoning) Object.assign(base.reasoning, overrides.reasoning);
    if (overrides.metrics) Object.assign(base.metrics, overrides.metrics);
    if (overrides.status) base.status = overrides.status;
  }
  return base;
}

// --- No data (no brf_financial_analysis, no brf_debt_per_m2_sek, no brf name) ---
{
  const result = housingAssociationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} }, attributes: {}, dataSources: baseSources,
  });
  check("no data - score null", result.score, null);
  check("no data - status", result.status, "No BRF data");
  check("no data - confidence", result.confidence, 0.05);
}

// --- BRF identified but no financial data ---
{
  const result = housingAssociationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { housing_association: "Brf Solbacken" },
    dataSources: baseSources,
  });
  check("brf identified - score null", result.score, null);
  check("brf identified - status", result.status, "BRF identified");
  check("brf identified - confidence 0.2 with name", result.confidence, 0.2);
}

// --- Insufficient verified data ---
{
  const result = housingAssociationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      brf_financial_analysis: { status: "insufficient_verified_data", metrics: makeAnalysis().metrics, reasoning: makeAnalysis().reasoning },
    },
    dataSources: baseSources,
  });
  check("insufficient verified - score null", result.score, null);
  check("insufficient verified - status", result.status, "Insufficient verified data");
  check("insufficient verified - confidence", result.confidence, 0.15);
}

// --- Strong finances (all signals strong_positive) ---
{
  const analysis = makeAnalysis({
    reasoning: {
      signals: [
        { metric: "equity_ratio", value: 0.6, strength: "strong_positive", thresholdDescription: "", confidence: 0.9 },
        { metric: "operating_margin", value: 0.25, strength: "strong_positive", thresholdDescription: "", confidence: 0.9 },
      ],
      findings: [{ dimension: "equity_ratio", classification: "strength", severity: null, summary: "Strong equity", confidence: 0.9, signalMetrics: ["equity_ratio"] }],
      overallConfidence: 0.85,
    },
  });
  const result = housingAssociationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { brf_financial_analysis: analysis },
    dataSources: baseSources,
  });
  check("strong finances - score >= 80", result.score >= 80, true);
  check("strong finances - status", result.status, "Strong finances");
}

// --- Critical finances (all signals strong_negative) ---
{
  const analysis = makeAnalysis({
    reasoning: {
      signals: [
        { metric: "equity_ratio", value: 0.05, strength: "strong_negative", thresholdDescription: "", confidence: 0.9 },
        { metric: "debt_per_apartment", value: 400000, strength: "strong_negative", thresholdDescription: "", confidence: 0.9 },
      ],
      findings: [
        { dimension: "equity_ratio", classification: "weakness", severity: "critical", summary: "Critical equity", confidence: 0.9, signalMetrics: ["equity_ratio"] },
      ],
      overallConfidence: 0.8,
    },
  });
  const result = housingAssociationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { brf_financial_analysis: analysis },
    dataSources: baseSources,
  });
  check("critical finances - score < 20", result.score < 20, true);
  check("critical finances - status", result.status, "Critical finances");
}

// --- Mixed finances (neutral signals) ---
{
  const analysis = makeAnalysis({
    reasoning: {
      signals: [
        { metric: "equity_ratio", value: 0.3, strength: "neutral", thresholdDescription: "", confidence: 0.8 },
      ],
      findings: [],
      overallConfidence: 0.7,
    },
  });
  const result = housingAssociationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { brf_financial_analysis: analysis },
    dataSources: baseSources,
  });
  check("mixed finances - score between 40-59", result.score >= 40 && result.score < 60, true);
  check("mixed finances - status", result.status, "Mixed finances");
}

// --- Edge: with brf name on successful analysis ---
{
  const analysis = makeAnalysis({
    reasoning: {
      signals: [
        { metric: "equity_ratio", value: 0.5, strength: "positive", thresholdDescription: "", confidence: 0.85 },
      ],
      findings: [],
      overallConfidence: 0.75,
    },
  });
  const result = housingAssociationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { brf_financial_analysis: analysis, housing_association: "Brf Solbacken" },
    dataSources: baseSources,
  });
  check("with brf name - score computed", typeof result.score === "number" && result.score !== null, true);
  check("with brf name - explanation includes BRF name", result.explanation.startsWith("Brf Solbacken:"), true);
  check("with brf name - supportingData has name", result.supportingData.housingAssociation, "Brf Solbacken");
}

// --- Edge: brf_debt_per_m2_sek present but no financial analysis (unreachable fallback) ---
{
  const result = housingAssociationAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { brf_debt_per_m2_sek: 15000 },
    dataSources: baseSources,
  });
  check("debtPerM2 present - fallback score null", result.score, null);
  check("debtPerM2 present - fallback status", result.status, "Insufficient data");
}

console.log(failures === 0 ? "\nAll housingAssociation checks passed." : `\n${failures} housingAssociation check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
