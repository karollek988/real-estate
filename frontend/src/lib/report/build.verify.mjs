// Standalone verification for lib/report/build.ts's Sprint 3 (Analysis
// Integration Audit) changes: the price chapter must render real Booli
// comparables/trend/previous-sale data when present instead of the old
// hardcoded "no comparables source connected" claim, and the property
// overview table must render the new Booli-only boolean facts
// (mortgage_deed, solar_panels, fireplace, bidding_open, new_construction)
// and the property's own previous sale. No test framework in this project -
// see identityTrust.verify.mjs. build.ts has no runtime relative/aliased
// imports (only `import type`, erased by type stripping), so — unlike
// buildAnalysis.ts/analyzers/*.ts, which have unresolved extensionless
// relative imports node can't follow without a bundler — it can be
// exercised directly. Run with:
//   node --experimental-strip-types src/lib/report/build.verify.mjs
import { buildPriceAnalysis, buildPropertyOverview } from "./build.ts";

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

function baseProperty(overrides = {}) {
  return {
    address: "Testvagen 1, Stockholm",
    postalCode: "11122",
    municipality: "Stockholm",
    floor: "3",
    apartmentNumber: null,
    propertyType: "Lagenhet",
    rooms: 3,
    buildingYear: 1932,
    renovationYear: null,
    housingAssociation: null,
    housingAssociationConflict: null,
    askingPriceSek: 4_500_000,
    monthlyFeeSek: 4200,
    operatingCostsSek: null,
    livingAreaM2: 68,
    additionalAreaM2: 5,
    lotAreaM2: null,
    pricePerM2Sek: 66176,
    previousSalePriceSek: null,
    previousSaleDate: null,
    mortgageDeed: null,
    solarPanels: null,
    fireplace: null,
    biddingOpen: null,
    newConstruction: null,
    energyClass: null,
    description: null,
    imageUrls: [],
    floorplanUrls: [],
    features: [],
    condition: null,
    balcony: true,
    elevator: true,
    parking: null,
    garage: null,
    storage: null,
    patio: false,
    broker: null,
    agency: null,
    listingDate: null,
    ownershipType: null,
    objectId: "5551234",
    ...overrides,
  };
}

function baseReport(propertyOverrides = {}, priceSupportingData = {}) {
  return {
    engineVersion: "test",
    generatedAt: new Date().toISOString(),
    factorsAnalyzed: 10,
    property: baseProperty(propertyOverrides),
    decisionScore: 60,
    overallConfidence: 0.6,
    verdict: "Requires a Closer Look",
    summary: "",
    insights: [],
    decisionFactors: [
      {
        id: "price",
        label: "Price Level",
        score: 55,
        confidence: 0.85,
        status: "Fair price",
        explanation: "Price factor explanation.",
        supportingData: { askingPriceSek: 4_500_000, ...priceSupportingData },
        missingData: [],
        weight: 0.25,
      },
    ],
    dataSources: [{ id: "booli_listing", name: "Listing & sold-price data (Booli)", kind: "real", status: "ok", fields: [] }],
    dataCompleteness: { connectedSources: 1, totalSources: 1 },
  };
}

/* -- price chapter: no comparables connected -- */
{
  const report = baseReport();
  const analysis = buildPriceAnalysis(report);
  check("no comparables -> comparableSales empty", analysis.comparableSales, []);
  check("no comparables -> areaSoldPriceTrend empty", analysis.areaSoldPriceTrend, []);
  check("no previous sale on the property -> previousSale is null", analysis.previousSale, null);
  check(
    "no comparables -> the 'not connected' paragraph is still shown (honest gap)",
    analysis.paragraphs.some((p) => p.includes("ingar inte i denna analys") || p.includes("ingår inte i denna analys")),
    true
  );
}

/* -- price chapter: Booli comparables + trend + previous sale connected -- */
{
  const comparableSales = [
    { address: "Testvagen 3", soldPriceSek: 4_200_000, soldDate: "2026-04-15", livingAreaM2: 70, rooms: 3, pricePerM2Sek: 60000 },
    { address: "Testvagen 5", soldPriceSek: 4_000_000, soldDate: "2026-01-20", livingAreaM2: 65, rooms: 2, pricePerM2Sek: 61538 },
  ];
  const areaSoldPriceTrend = [
    { period: "2026-Q1", medianPricePerM2Sek: 61538, count: 1 },
    { period: "2026-Q2", medianPricePerM2Sek: 60000, count: 1 },
  ];
  const report = baseReport(
    { previousSalePriceSek: 3_800_000, previousSaleDate: "2021-03-10" },
    { comparableSales, comparableSalesCount: 2, areaSoldPriceTrend, areaMedianPricePerM2Sek: 61538, deltaVsAreaMedianPct: 7.6 }
  );
  const analysis = buildPriceAnalysis(report);

  check("comparables flow through to the report", analysis.comparableSales, comparableSales);
  check("trend flows through to the report", analysis.areaSoldPriceTrend, areaSoldPriceTrend);
  check("previous sale flows through to the report", analysis.previousSale, { priceSek: 3_800_000, date: "2021-03-10" });
  check(
    "the stale 'no comparables source connected' claim is gone once comparables exist",
    analysis.paragraphs.some((p) => p.includes("ingar inte i denna analys") || p.includes("ingår inte i denna analys")),
    false
  );
  check(
    "a real comparables paragraph replaces it",
    analysis.paragraphs.some((p) => p.startsWith("2 ") && p.includes("Booli")),
    true
  );
  check(
    "a previous-sale paragraph is included",
    analysis.paragraphs.some((p) => p.includes("3 800 000") || p.includes("3 800 000") || p.includes("38")),
    true
  );
}

/* -- property overview: new Booli-only boolean facts and previous sale -- */
{
  const report = baseReport({
    solarPanels: true,
    fireplace: false,
    mortgageDeed: true,
    newConstruction: false,
    biddingOpen: true,
    previousSalePriceSek: 3_800_000,
    previousSaleDate: "2021-03-10",
  });
  const rows = buildPropertyOverview(report, {});
  const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));

  const solarRow = rows.find((r) => r.label.toLowerCase().includes("solc"));
  const fireplaceRow = rows.find((r) => r.label.includes("ppen spis"));
  const mortgageRow = rows.find((r) => r.label === "Pantbrev");
  const newConstructionRow = rows.find((r) => r.label.toLowerCase().startsWith("nyprod"));
  const biddingRow = rows.find((r) => r.label.includes("ppen budgivning"));
  const previousSaleRow = rows.find((r) => r.label.includes("rsaljning") || r.label.includes("rsäljning"));

  check("overview table gained a solar panels row", solarRow !== undefined, true);
  check("solar panels rendered as Ja", solarRow ? byLabel[solarRow.label] : undefined, "Ja");
  check("overview table gained a fireplace row", fireplaceRow !== undefined, true);
  check("fireplace rendered as Nej", fireplaceRow ? byLabel[fireplaceRow.label] : undefined, "Nej");
  check("overview table gained a mortgage deed row", mortgageRow !== undefined, true);
  check("mortgage deed rendered as Ja", mortgageRow ? byLabel[mortgageRow.label] : undefined, "Ja");
  check("overview table gained a new construction row", newConstructionRow !== undefined, true);
  check("new construction rendered as Nej", newConstructionRow ? byLabel[newConstructionRow.label] : undefined, "Nej");
  check("overview table gained a bidding open row", biddingRow !== undefined, true);
  check("bidding open rendered as Ja", biddingRow ? byLabel[biddingRow.label] : undefined, "Ja");
  check("overview table gained a previous sale row", previousSaleRow !== undefined, true);
  const previousSaleValue = previousSaleRow ? byLabel[previousSaleRow.label] : "";
  check(
    "previous sale row mentions both the price and the year",
    previousSaleValue.includes("800") && previousSaleValue.includes("2021"),
    true
  );
}

/* -- property overview: unknown booleans render as "Uppgift saknas", never hidden -- */
{
  const report = baseReport();
  const rows = buildPropertyOverview(report, {});
  const solarRow = rows.find((r) => r.label.toLowerCase().includes("solc"));
  check("unknown solar panels status renders as Uppgift saknas, not silently omitted", solarRow?.value, "Uppgift saknas");
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
