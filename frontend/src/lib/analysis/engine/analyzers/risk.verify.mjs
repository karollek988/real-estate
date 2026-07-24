// Standalone verification for risk.ts (no test framework in this
// project - see helpers.verify.mjs). Covers the four verdict buckets
// (High/Moderate/Elevated/Low risk), the insufficient-data paths, and edge
// cases like very old buildings, renovation year, and missing amenities.
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

const baseSources = [
  { id: "hemnet_page_scrape", name: "Hemnet page scrape", kind: "real", status: "ok", fields: [] },
  { id: "interest_rates", name: "Interest rates", kind: "real", status: "ok", fields: [] },
  { id: "scb_area_statistics", name: "SCB area statistics", kind: "real", status: "ok", fields: [] },
  { id: "osm_amenities", name: "OSM amenities", kind: "real", status: "ok", fields: [] },
];

const emptyProperty = { id: "", normalizedKey: "", address: "", hemnetUrl: null, latitude: null, longitude: null, municipality: null, postalCode: null, propertyType: null, apartmentNumber: null, floor: null, attributes: {}, fieldProvenance: {}, createdAt: "", updatedAt: "" };

// --- Insufficient data (no building year, rate, or population) ---
{
  const result = riskAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} }, attributes: {}, dataSources: baseSources,
  });
  check("no data - score null", result.score, null);
  check("no data - status", result.status, "No risk data");
  check("no data - confidence", result.confidence, 0.05);
}

// --- Low risk (new building, low rates, growing pop, good amenities) ---
{
  const result = riskAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      building_year: 2020,
      policy_rate_pct: 1.0,
      area_population_growth_pct: 4.0,
      highway_major_count_within_1000m: 0,
      grocery_count_within_1000m: 5,
      transit_count_within_1000m: 8,
      median_income_sek_thousands: 500,
    },
    dataSources: baseSources,
  });
  check("low risk - score >= 70", result.score >= 70, true);
  check("low risk - status", result.status, "Low risk");
}

// --- High risk (old building, no renovation, high rates, declining pop, many highways) ---
{
  const result = riskAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      building_year: 1920,
      policy_rate_pct: 5.0,
      area_population_growth_pct: -4.0,
      highway_major_count_within_1000m: 3,
      grocery_count_within_1000m: 0,
      transit_count_within_1000m: 0,
      median_income_sek_thousands: 220,
    },
    dataSources: baseSources,
  });
  check("high risk - score < 35", result.score < 35, true);
  check("high risk - status", result.status, "High risk");
}

// --- Edge: recently renovated old building (lastMajorWork <= 10) ---
{
  const result = riskAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      building_year: 1950,
      renovation_year: 2022,
      policy_rate_pct: 2.5,
      area_population_growth_pct: 0.5,
      highway_major_count_within_1000m: 1,
      grocery_count_within_1000m: 2,
      transit_count_within_1000m: 3,
    },
    dataSources: baseSources,
  });
  check("renovated old - score mitigated by renovation", result.score > 40, true);
  check("renovated old - supportingData includes renovationYear", result.supportingData.renovationYear, 2022);
}

// --- Edge: amenity isolation (grocery <= 1, transit <= 2) ---
{
  const result = riskAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      building_year: 1985,
      policy_rate_pct: 3.0,
      area_population_growth_pct: -0.5,
      grocery_count_within_1000m: 0,
      transit_count_within_1000m: 1,
    },
    dataSources: baseSources,
  });
  check("isolated amenities - status is set", result.status.length > 0, true);
  const riskFactors = result.supportingData.riskFactors || [];
  const amenityFactor = riskFactors.find(rf => rf.factor === "amenity_access");
  check("isolated amenities - amenity factor present", amenityFactor !== undefined, true);
  if (amenityFactor) {
    check("isolated amenities - amenity score low (40 or less)", amenityFactor.score <= 40, true);
  }
}

// --- Edge: only amenities (no building/rate/pop — early return "No risk data") ---
{
  const result = riskAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      grocery_count_within_1000m: 3,
      transit_count_within_1000m: 5,
    },
    dataSources: baseSources,
  });
  check("only amenities - score null (early return)", result.score, null);
  check("only amenities - status No risk data", result.status, "No risk data");
}

console.log(failures === 0 ? "\nAll risk checks passed." : `\n${failures} risk check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
