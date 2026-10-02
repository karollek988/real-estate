// Standalone verification for the "area-only" entitlement (lib/analysis/redact.ts
// + access.ts's resolveViewScope): someone who bought only an Områdesanalys must
// receive the area chapter's data and NOTHING else — not even when the stored,
// shared analysis is a full one made for somebody else. No test framework in this
// project (see the other *.verify.mjs). Run with:
//   npx tsx src/lib/analysis/redact.verify.mjs
import {
  AREA_REPORT_ATTRIBUTE_KEYS,
  redactAnalysisRecord,
  redactAnalysisReport,
  redactPropertyForScope,
} from "./redact.ts";
import { resolveViewScope } from "./access.ts";
import { buildAreaAnalysis } from "../report/build.ts";

let failures = 0;
function check(name, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
  if (!condition) {
    failures++;
    if (detail !== undefined) console.log("  detail:", detail);
  }
}

// Every value that must never reach an area-only viewer carries "LEAK_" so a
// single substring search over the serialized output proves nothing slipped through.
const LEAK = "LEAK_";

function fullReport() {
  return {
    engineVersion: "test",
    generatedAt: "2026-10-02T00:00:00.000Z",
    property: {
      address: "Storgatan 12, Stockholm",
      postalCode: "11122",
      municipality: "Stockholm",
      floor: `${LEAK}floor`,
      apartmentNumber: `${LEAK}lgh`,
      propertyType: `${LEAK}type`,
      rooms: 3,
      buildingYear: 1950,
      renovationYear: 2010,
      housingAssociation: `${LEAK}brf`,
      housingAssociationConflict: { keptValue: `${LEAK}a`, rejectedValue: `${LEAK}b`, rejectedSource: `${LEAK}c` },
      askingPriceSek: 4_999_999,
      monthlyFeeSek: 4_321,
      operatingCostsSek: 1_234,
      livingAreaM2: 77,
      additionalAreaM2: 5,
      lotAreaM2: 100,
      pricePerM2Sek: 64_935,
      previousSalePriceSek: 3_000_000,
      previousSaleDate: "2020-01-01",
      mortgageDeed: true,
      solarPanels: true,
      fireplace: true,
      biddingOpen: true,
      newConstruction: false,
      energyClass: "C",
      description: `${LEAK}description`,
      imageUrls: [`${LEAK}img1`, `${LEAK}img2`],
      floorplanUrls: [`${LEAK}plan`],
      features: [`${LEAK}feature`],
      condition: `${LEAK}condition`,
      balcony: true,
      elevator: true,
      parking: true,
      garage: true,
      storage: true,
      patio: true,
      broker: `${LEAK}broker`,
      agency: `${LEAK}agency`,
      listingDate: "2026-09-01",
      ownershipType: `${LEAK}ownership`,
      objectId: `${LEAK}object`,
    },
    decisionFactors: [
      { id: "market", available: true, supportingData: { policyRateChangePctPoints: -0.5, note: `${LEAK}market` } },
      { id: "housingAssociation", available: true, supportingData: { debt: `${LEAK}debt`, reportState: "verified" } },
      { id: "area", available: true, supportingData: { municipality: "Stockholm", areaPriceTrendPct: 3 } },
      { id: "risk", available: true, supportingData: { buildingYear: 1950, note: `${LEAK}risk` } },
      { id: "futureDevelopment", available: true, supportingData: { nearbyPlannedProjects: [`${LEAK}project`] } },
    ],
    dataSources: [
      { id: "hemnet_page_scrape", name: "Hemnet", kind: "real", status: "ok", fields: [`${LEAK}field`], detail: `${LEAK}detail` },
      { id: "brf_financials", name: "BRF", kind: "real", status: "ok", fields: [] },
      { id: "interest_rates", name: "Riksbanken", kind: "real", status: "ok", fields: [] },
      { id: "nominatim_geocoding", name: "Geocoding", kind: "real", status: "ok", fields: ["latitude"] },
      { id: "osm_amenities", name: "OSM", kind: "real", status: "ok", fields: ["grocery_count_within_1000m"] },
      { id: "scb_area_statistics", name: "SCB", kind: "real", status: "no_data", fields: [] },
      { id: "some_placeholder", name: "Placeholder", kind: "placeholder", status: "not_connected", fields: [] },
    ],
    dataCompleteness: { connectedSources: 5, totalSources: 7 },
  };
}

function propertyRecord() {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    normalizedKey: `${LEAK}key`,
    address: "Storgatan 12",
    hemnetUrl: `${LEAK}https://hemnet.example/bostad/1`,
    latitude: 59.3,
    longitude: 18.0,
    municipality: "Stockholm",
    postalCode: "11122",
    propertyType: `${LEAK}type`,
    apartmentNumber: `${LEAK}lgh`,
    floor: 3,
    attributes: {
      asking_price_sek: 4_999_999,
      monthly_fee_sek: 4_321,
      housing_association: `${LEAK}brf`,
      brf_annual_report: { debt: `${LEAK}debt` },
      description: `${LEAK}description`,
      image_urls: [`${LEAK}img`],
      grocery_count_within_1000m: 7,
      commute_centrum_name: "Stockholm C",
      area_population_growth_pct: 4.2,
      median_income_sek_thousands: 480,
      nearby_primary_schools: [{ name: "Skolan", distanceM: 400 }],
    },
    fieldProvenance: { asking_price_sek: { source: `${LEAK}hemnet`, confidence: 1, updatedAt: "x" } },
    createdAt: "2026-01-01",
    updatedAt: "2026-01-02",
  };
}

// ── area scope: report ───────────────────────────────────────────────────────
const area = redactAnalysisReport(fullReport(), "area");
const areaJson = JSON.stringify(area);

check("area report contains no leaked listing/BRF/risk/summary value anywhere", !areaJson.includes(LEAK), areaJson.match(/LEAK_\w+/g));
check("area report has no asking price, fee or size", area.property.askingPriceSek === null && area.property.monthlyFeeSek === null && area.property.livingAreaM2 === null && area.property.pricePerM2Sek === null);
check("area report keeps the location (address, municipality, postal code)", area.property.address === "Storgatan 12, Stockholm" && area.property.municipality === "Stockholm" && area.property.postalCode === "11122");
check("area report has no images/floorplans", area.property.imageUrls.length === 0 && area.property.floorplanUrls.length === 0);
check("area report keeps only the area decision factor", area.decisionFactors.length === 1 && area.decisionFactors[0].id === "area");
check(
  "area report has exactly the report's own keys (nothing extra carried over)",
  Object.keys(area).sort().join(",") === "dataCompleteness,dataSources,decisionFactors,engineVersion,generatedAt,property",
  Object.keys(area)
);
check(
  "area report keeps only area data sources",
  area.dataSources.map((s) => s.id).sort().join(",") === "nominatim_geocoding,osm_amenities,scb_area_statistics",
  area.dataSources.map((s) => s.id)
);
check("area report's source counts follow the filtered sources", area.dataCompleteness.totalSources === 3 && area.dataCompleteness.connectedSources === 3, area.dataCompleteness);

// ── full scope: the report is returned complete and unchanged ────────────────
const full = redactAnalysisReport(fullReport(), "full");
check("full report keeps every decision factor", full.decisionFactors.length === 5);
check("full report keeps listing facts and sources", full.property.askingPriceSek === 4_999_999 && full.dataSources.length === 7);
check("full report is returned unchanged", JSON.stringify(full) === JSON.stringify(fullReport()));

// ── area scope: property record ──────────────────────────────────────────────
const areaProperty = redactPropertyForScope(propertyRecord(), "area");
const areaPropertyJson = JSON.stringify(areaProperty);
check("area property has no leaked value anywhere", !areaPropertyJson.includes(LEAK), areaPropertyJson.match(/LEAK_\w+/g));
check("area property attributes are only allowlisted area keys", Object.keys(areaProperty.attributes).every((k) => AREA_REPORT_ATTRIBUTE_KEYS.includes(k)), Object.keys(areaProperty.attributes));
check("area property keeps the area attributes the chapter reads", areaProperty.attributes.grocery_count_within_1000m === 7 && areaProperty.attributes.area_population_growth_pct === 4.2 && Array.isArray(areaProperty.attributes.nearby_primary_schools));
check("area property drops price, fee, BRF and listing text", !("asking_price_sek" in areaProperty.attributes) && !("monthly_fee_sek" in areaProperty.attributes) && !("brf_annual_report" in areaProperty.attributes) && !("description" in areaProperty.attributes));
check("area property drops hemnet url, apartment number, floor, key, provenance", areaProperty.hemnetUrl === null && areaProperty.apartmentNumber === null && areaProperty.floor === null && areaProperty.normalizedKey === "" && Object.keys(areaProperty.fieldProvenance).length === 0);
check("full property is returned untouched", redactPropertyForScope(propertyRecord(), "full").attributes.asking_price_sek === 4_999_999);

// ── analysis record (the API response also carries the run log) ──────────────
const record = {
  id: "22222222-2222-2222-2222-222222222222",
  propertyId: "11111111-1111-1111-1111-111111111111",
  version: 3,
  engineVersion: "test",
  scope: "full",
  status: "complete",
  report: fullReport(),
  dataSources: fullReport().dataSources,
  error: null,
  failureReason: null,
  createdAt: "2026-10-01",
  completedAt: "2026-10-01",
};
const areaRecord = redactAnalysisRecord(record, "area");
const areaRecordJson = JSON.stringify(areaRecord);
check("area analysis record has no leaked value (report, run log)", !areaRecordJson.includes(LEAK), areaRecordJson.match(/LEAK_\w+/g));
check("full analysis record keeps its run log", redactAnalysisRecord(record, "full").dataSources.length === 7);
check("a record without a report redacts without throwing", redactAnalysisRecord({ ...record, report: null, status: "pending" }, "area").report === null);

// ── effective view scope ─────────────────────────────────────────────────────
check("full owner + full analysis -> full", resolveViewScope("full", "full") === "full");
check("full owner + area-only analysis -> area (never an empty 'full' report)", resolveViewScope("full", "area") === "area");
check("area owner + full analysis -> area (a full analysis made for someone else stays redacted)", resolveViewScope("area", "full") === "area");
check("area owner + area analysis -> area", resolveViewScope("area", "area") === "area");

// ── allowlist drift guard ────────────────────────────────────────────────────
// Record every attribute key buildAreaAnalysis() actually reads; each one has to
// be on the allowlist or the area chapter would silently lose data for area-only
// viewers (or, if the list were widened carelessly, leak more than the chapter).
const read = new Set();
const proxy = new Proxy({}, {
  get(_target, key) {
    if (typeof key === "string") read.add(key);
    return undefined;
  },
  has(_target, key) {
    if (typeof key === "string") read.add(key);
    return false;
  },
});
buildAreaAnalysis(redactAnalysisReport(fullReport(), "area"), proxy, redactAnalysisReport(fullReport(), "area").dataSources);
const missingFromAllowlist = [...read].filter((k) => !AREA_REPORT_ATTRIBUTE_KEYS.includes(k));
check("every attribute buildAreaAnalysis() reads is on the area allowlist", missingFromAllowlist.length === 0, missingFromAllowlist);
check("the drift guard actually observed attribute reads", read.size > 10, [...read]);

// The chapter built from the allowlisted attributes alone equals the one built from everything.
const everything = propertyRecord().attributes;
const allowlisted = redactPropertyForScope(propertyRecord(), "area").attributes;
const rep = redactAnalysisReport(fullReport(), "area");
check(
  "the area chapter renders identically from allowlisted attributes and from all attributes",
  JSON.stringify(buildAreaAnalysis(rep, allowlisted, rep.dataSources)) === JSON.stringify(buildAreaAnalysis(rep, everything, rep.dataSources))
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
