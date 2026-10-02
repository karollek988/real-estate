// Standalone verification for lib/report/housingCost.ts — the verified cost
// rules the coming Boendekalkyl is built on (the chapter itself is still a
// placeholder). The pitch deck's example: lagfart on a 4 000 000 kr house is
// 60 825 kr. No test framework in this project (see the other *.verify.mjs).
// Run with:
//   npx tsx src/lib/report/housingCost.verify.mjs
import { amortizationRate, buildHousingCost, lagfartSek, MAX_LOAN_TO_VALUE } from "./housingCost.ts";

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

check("lagfart 4 000 000 kr = 1.5 % + 825 kr = 60 825 kr", lagfartSek(4_000_000), 60_825);
check("lagfart rounds the price down to whole thousands", lagfartSek(4_000_999), 60_825);
check("loan cap 90 % (from 1 April 2026)", MAX_LOAN_TO_VALUE, 0.9);
check("amortization above 70 % LTV", amortizationRate(0.9), 0.02);
check("amortization 50-70 % LTV", amortizationRate(0.6), 0.01);
check("no amortization at or below 50 %", amortizationRate(0.5), 0);

const property = (overrides) => ({
  address: "Exempelvägen 1, Huddinge",
  postalCode: null, municipality: "Huddinge", floor: null, apartmentNumber: null,
  propertyType: "Villa", rooms: 5, buildingYear: 1975, renovationYear: null,
  housingAssociation: null, housingAssociationConflict: null,
  askingPriceSek: 4_000_000, monthlyFeeSek: null, operatingCostsSek: 48_000,
  livingAreaM2: 130, additionalAreaM2: null, lotAreaM2: 800, pricePerM2Sek: 30_769,
  previousSalePriceSek: null, previousSaleDate: null, mortgageDeed: null, solarPanels: null, fireplace: null,
  biddingOpen: null, newConstruction: null, energyClass: null, description: null, imageUrls: [], floorplanUrls: [],
  features: [], condition: null, balcony: null, elevator: null, parking: null, garage: null, storage: null, patio: null,
  broker: null, agency: null, listingDate: null, ownershipType: "Äganderätt", objectId: null,
  ...overrides,
});
const report = (p) => ({ engineVersion: "test", generatedAt: "", property: p, decisionFactors: [], dataSources: [], dataCompleteness: { connectedSources: 0, totalSources: 0 } });

{
  const cost = buildHousingCost(report(property({})));
  check("house: loan 90 % of 4 000 000", cost.loan.amountSek, 3_600_000);
  check("house: down payment 400 000", cost.loan.downPaymentSek, 400_000);
  check("house: 2 % amortization = 6 000 kr/month", cost.scenarios[0].amortizationPerMonthSek, 6_000);
  check("house: 3 % interest = 9 000 kr/month", cost.scenarios[0].interestPerMonthSek, 9_000);
  check("house: operating costs 4 000 kr/month are in the total", cost.scenarios[0].totalPerMonthSek, 19_000);
  check("house: lagfart row", cost.purchaseRows.find((r) => r.label === "Lagfart")?.value.replace(/\s/g, " "), "60 825 kr");
}
{
  const cost = buildHousingCost(report(property({ propertyType: "Lägenhet", ownershipType: "Bostadsrätt", monthlyFeeSek: 4_500, operatingCostsSek: null })));
  check("bostadsrätt: no lagfart", cost.purchaseRows.find((r) => r.label === "Lagfart")?.value, "Tas inte ut");
  check("bostadsrätt: the fee is the fixed monthly part", cost.fixedMonthlySek, 4_500);
}
{
  const cost = buildHousingCost(report(property({ askingPriceSek: null })));
  check("no price: nothing price-based is calculated", [cost.calculable, cost.loan, cost.scenarios.length], [false, null, 0]);
}

if (failures > 0) {
  console.log(`\n${failures} housing-cost check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll housing-cost checks passed.");
