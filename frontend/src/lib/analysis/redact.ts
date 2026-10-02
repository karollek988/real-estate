import type { AnalysisRecord, AnalysisReport, AnalysisScope, PropertyRecord } from "./types";
import { AREA_SCOPE_SOURCE_IDS } from "./providers/registry";

/**
 * Server-side scoping of what a viewer may see. There are two entitlements
 * and no in-between state (see ownership.ts):
 *
 *   "full" — the complete report. Everything stored is returned as-is.
 *   "area" — the standalone Områdesanalys. The viewer gets the area chapter
 *            and nothing else: no price, listing facts, housing association,
 *            risks, outlook or conclusion — not even when the underlying
 *            (shared, cached-per-property) analysis happens to be a full one
 *            produced for somebody else.
 *
 * This runs on the raw AnalysisReport / PropertyRecord, upstream of
 * lib/report/build.ts's chapter builders, so a chapter the viewer isn't
 * entitled to never even receives the data it would render. It is an
 * allowlist on purpose: every field is named explicitly below, so a field
 * added to AnalysisReport later fails to compile here (areaOnlyPropertyBlock
 * must return the complete property shape) instead of silently reaching an
 * area-only viewer.
 */

/**
 * Every `attributes` key lib/report/build.ts's buildAreaAnalysis() reads.
 * redact.verify.mjs records the keys that function actually touches and
 * fails if one is missing from this list, so it can't drift silently.
 */
export const AREA_REPORT_ATTRIBUTE_KEYS: readonly string[] = [
  // Amenities within 1 km (OpenStreetMap)
  "grocery_count_within_1000m",
  "school_count_within_1000m",
  "restaurant_count_within_1000m",
  "park_count_within_1000m",
  "transit_count_within_1000m",
  "hospital_count_within_1000m",
  // Commute
  "commute_centrum_name",
  "commute_centrum_car_minutes",
  "commute_centrum_transit_minutes",
  "commute_centrum_walk_minutes",
  "commute_city_name",
  "commute_city_car_minutes",
  "commute_city_transit_minutes",
  // Safety & civic data (kommun/county level)
  "area_safety_index",
  "area_recent_police_events",
  "area_voter_turnout_pct",
  // Schools
  "nearby_preschools",
  "nearby_primary_schools",
  "nearby_high_schools",
  "schools_register_extract_date",
  // Area development
  "area_population_growth_pct",
  "median_income_sek_thousands",
  "area_sold_price_trend",
];

const AREA_FACTOR_IDS = new Set(["area"]);

/** The report's property block with every listing fact blanked — only the location survives. */
function areaOnlyPropertyBlock(p: AnalysisReport["property"]): AnalysisReport["property"] {
  return {
    address: p.address,
    postalCode: p.postalCode,
    municipality: p.municipality,
    floor: null,
    apartmentNumber: null,
    propertyType: null,
    rooms: null,
    buildingYear: null,
    renovationYear: null,
    housingAssociation: null,
    housingAssociationConflict: null,
    askingPriceSek: null,
    monthlyFeeSek: null,
    operatingCostsSek: null,
    livingAreaM2: null,
    additionalAreaM2: null,
    lotAreaM2: null,
    pricePerM2Sek: null,
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
    balcony: null,
    elevator: null,
    parking: null,
    garage: null,
    storage: null,
    patio: null,
    broker: null,
    agency: null,
    listingDate: null,
    ownershipType: null,
    objectId: null,
  } satisfies AnalysisReport["property"];
}

export function redactAnalysisReport(full: AnalysisReport, scope: AnalysisScope): AnalysisReport {
  // decisionScore/verdict/overallConfidence are dropped for everyone (Köpanalys
  // no longer scores/rates properties), not just area-only viewers. Nothing in
  // the UI reads these anymore; kept as empty/zero rather than removed from the
  // type since the DB column/engine output is unchanged and other internal
  // code may still reference the shape.
  const base: AnalysisReport = { ...full, decisionScore: 0, verdict: "", overallConfidence: 0 };
  if (scope === "full") return base;

  const dataSources = (full.dataSources ?? []).filter((s) => AREA_SCOPE_SOURCE_IDS.has(s.id));
  return {
    engineVersion: full.engineVersion,
    generatedAt: full.generatedAt,
    factorsAnalyzed: 0,
    property: areaOnlyPropertyBlock(full.property),
    decisionScore: 0,
    overallConfidence: 0,
    verdict: "",
    // The composed summary sentence and the insight cards mix in price,
    // confidence and market facts and carry no source-factor id to filter on,
    // so they are dropped whole.
    summary: "",
    insights: [],
    decisionFactors: (full.decisionFactors ?? []).filter((f) => AREA_FACTOR_IDS.has(f.id)),
    dataSources,
    dataCompleteness: {
      connectedSources: dataSources.filter((s) => s.kind === "real").length,
      totalSources: dataSources.length,
    },
  };
}

/**
 * An analysis record as the given scope may see it. The record carries more
 * than `report`: the per-provider run log (`dataSources`, with free-text
 * detail) and the score column — an area-only viewer gets neither beyond the
 * area sources.
 */
export function redactAnalysisRecord(analysis: AnalysisRecord, scope: AnalysisScope): AnalysisRecord {
  const report = analysis.report ? redactAnalysisReport(analysis.report, scope) : null;
  if (scope === "full") return { ...analysis, report };
  return {
    ...analysis,
    report,
    decisionScore: null,
    dataSources: (analysis.dataSources ?? []).filter((s) => AREA_SCOPE_SOURCE_IDS.has(s.id)),
  };
}

/**
 * The property record as an area-only viewer may see it: where it is, and
 * the area attributes — not the listing (price, fee, size, images, the Hemnet
 * URL, apartment number, the housing association, user-entered form fields).
 */
export function redactPropertyForScope(property: PropertyRecord, scope: AnalysisScope): PropertyRecord {
  if (scope === "full") return property;

  const attributes: Record<string, unknown> = {};
  for (const key of AREA_REPORT_ATTRIBUTE_KEYS) {
    if (key in property.attributes) attributes[key] = property.attributes[key];
  }
  return {
    ...property,
    normalizedKey: "",
    hemnetUrl: null,
    propertyType: null,
    apartmentNumber: null,
    floor: null,
    attributes,
    fieldProvenance: {},
  };
}
