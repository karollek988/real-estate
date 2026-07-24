import type {
  AnalysisReport,
  DataSourceReport,
  DecisionFactorResult,
  ExtractedProperty,
  Insight,
  PropertyRecord,
} from "../types";
import type { ProviderResult } from "../providers/types";
import { runDecisionEngine } from "./decisionEngine";
import { housingAssociationConflictOrNull, numberOrNull, stringOrNull } from "./helpers";

/**
 * Adapter between the Decision Engine (engine/decisionEngine.ts +
 * engine/analyzers/) and the persisted AnalysisReport shape the report page
 * consumes. The engine is the actual intelligence; this module just runs
 * it, assembles the property fact block, and maps the 6 decision-relevant
 * factors onto `insights` in the exact shape/order the (unchanged) report
 * UI already expects.
 */
/**
 * Two independently-versioned halves of the analysis pipeline (End-to-End
 * Truth Audit fix #3 — cached analyses must invalidate whenever EITHER
 * changes, not just this one). TS_ENGINE_VERSION covers this Decision
 * Engine (buildAnalysis.ts + analyzers/ + pipeline.ts). PYTHON_ENGINE_VERSION
 * mirrors analysis_engine/calculator.py's ANALYSIS_ENGINE_VERSION (which
 * covers calculate_metrics()/run_reasoning() and BRF-Scraper's
 * extractor/validation.py + discovery/allabrf_provider.py, the Python side
 * of this same pipeline) — bump both together when either side changes.
 * ENGINE_VERSION is the combined string actually persisted per analysis and
 * compared for cache freshness (see pipeline.ts::requestAnalysis).
 */
export const TS_ENGINE_VERSION = "0.5.1";
export const PYTHON_ENGINE_VERSION = "1.0.0";
export const ENGINE_VERSION = `${TS_ENGINE_VERSION}+py${PYTHON_ENGINE_VERSION}`;

/** Report UI card order — unchanged from the pre-Decision-Engine report. */
const UI_INSIGHT_FACTOR_IDS = [
  "price",
  "futureDevelopment",
  "risk",
  "negotiation",
  "housingAssociation",
  "area",
];

function toInsight(factor: DecisionFactorResult): Insight {
  return {
    label: factor.label,
    value: factor.status,
    tone: factor.score !== null && factor.score >= 60 ? "positive" : "neutral",
    pending: factor.score === null,
  };
}

export function buildAnalysis(
  property: PropertyRecord,
  extracted: ExtractedProperty,
  providerResults: ProviderResult[]
): AnalysisReport {
  const dataSources: DataSourceReport[] = providerResults.map((r) => r.source);
  const connectedSources = dataSources.filter((s) => s.kind === "real").length;
  const attributes = { ...extracted.attributes, ...property.attributes };

  const engineResult = runDecisionEngine({ property, extracted, attributes, dataSources });
  const factorById = new Map(engineResult.factors.map((f) => [f.id, f]));
  const insights = UI_INSIGHT_FACTOR_IDS.map((id) => factorById.get(id))
    .filter((f): f is DecisionFactorResult => f !== undefined)
    .map(toInsight);

  const buildingYear = numberOrNull(attributes.building_year);
  const renovationYear = numberOrNull(attributes.renovation_year);
  const rooms = extracted.rooms ?? numberOrNull(attributes.rooms);
  // Prefer the Hemnet listing page's value (richer, e.g. "4 av 6" or "lgh 1203")
  // over the URL-slug-derived one on the property record; fall back to the
  // slug value when the page didn't have it.
  const floor = stringOrNull(attributes.floor) ?? (property.floor !== null ? String(property.floor) : null);
  // Prefer the Hemnet listing page's street address (correct å/ä/ö/é) over
  // the URL-slug-derived one on the property record, which is ASCII-folded
  // because Hemnet strips diacritics from slugs.
  const streetAddress = stringOrNull(attributes.street_address) ?? property.address;
  const apartmentNumber = stringOrNull(attributes.apartment_number) ?? property.apartmentNumber;
  // Hemnet's own label wins when both are present (same trust order as
  // identityTrust.ts); Booli's objectType is the only source at all when a
  // property was found via Booli without a matching Hemnet listing.
  const propertyType =
    stringOrNull(attributes.property_type_hemnet) ?? stringOrNull(attributes.property_type_booli) ?? property.propertyType;
  const lotAreaM2 = numberOrNull(attributes.lot_area_m2);
  const previousSalePriceSek = numberOrNull(attributes.previous_sale_price_sek);
  const previousSaleDate = stringOrNull(attributes.previous_sale_date);
  const mortgageDeed = typeof attributes.mortgage_deed === "boolean" ? (attributes.mortgage_deed as boolean) : null;
  const solarPanels = typeof attributes.solar_panels === "boolean" ? (attributes.solar_panels as boolean) : null;
  const fireplace = typeof attributes.fireplace === "boolean" ? (attributes.fireplace as boolean) : null;
  const biddingOpen = typeof attributes.bidding_open === "boolean" ? (attributes.bidding_open as boolean) : null;
  const newConstruction = typeof attributes.new_construction === "boolean" ? (attributes.new_construction as boolean) : null;
  const housingAssociationConflict = housingAssociationConflictOrNull(attributes.housing_association_conflict);
  const geocoded = property.latitude !== null && property.longitude !== null;
  const askingPriceSek = numberOrNull(attributes.asking_price_sek);
  const monthlyFeeSek = numberOrNull(attributes.monthly_fee_sek);
  const operatingCostsSek = numberOrNull(attributes.operating_costs_sek);
  const livingAreaM2 = numberOrNull(attributes.living_area_m2);
  const additionalAreaM2 = numberOrNull(attributes.additional_area_m2);
  const energyClass = stringOrNull(attributes.energy_class);
  const description = stringOrNull(attributes.description);
  const condition = stringOrNull(attributes.condition);
  const balcony = typeof attributes.balcony === "boolean" ? attributes.balcony as boolean : null;
  const elevator = typeof attributes.elevator === "boolean" ? attributes.elevator as boolean : null;
  const parking = typeof attributes.parking === "boolean" ? attributes.parking as boolean : null;
  const garage = typeof attributes.garage === "boolean" ? attributes.garage as boolean : null;
  const storage = typeof attributes.storage === "boolean" ? attributes.storage as boolean : null;
  const patio = typeof attributes.patio === "boolean" ? attributes.patio as boolean : null;
  const broker = stringOrNull(attributes.broker);
  const agency = stringOrNull(attributes.agency);
  const listingDate = stringOrNull(attributes.listing_date);
  const ownershipType = stringOrNull(attributes.ownership_type);
  const booliId = numberOrNull(attributes.booli_id);
  const objectId =
    stringOrNull(attributes.hemnet_object_id) ?? stringOrNull(attributes.hemnet_listing_id) ?? (booliId !== null ? String(booliId) : null);
  const pricePerM2Sek = (askingPriceSek !== null && livingAreaM2 !== null && livingAreaM2 > 0)
    ? Math.round(askingPriceSek / livingAreaM2)
    : null;
  const imageUrls = Array.isArray(attributes.image_urls)
    ? (attributes.image_urls as unknown[]).filter((u): u is string => typeof u === "string")
    : [];
  const floorplanUrls = Array.isArray(attributes.floorplan_urls)
    ? (attributes.floorplan_urls as unknown[]).filter((u): u is string => typeof u === "string")
    : [];
  const features = Array.isArray(attributes.features)
    ? (attributes.features as unknown[]).filter((f): f is string => typeof f === "string")
    : [];

  // Additional context for summary
  const populationGrowth = numberOrNull(attributes.area_population_growth_pct);
  const policyRate = numberOrNull(attributes.policy_rate_pct);
  const medianIncome = numberOrNull(attributes.median_income_sek_thousands);

  // Facts we actually hold, whatever their origin (URL slug, manual entry, or
  // a provider) — each fact is counted exactly once, since provider-sourced
  // values already flow into `attributes`/the property columns above.
  const factorsAnalyzed = [
    property.address,
    property.municipality,
    property.postalCode,
    property.propertyType,
    property.apartmentNumber,
    property.floor,
    property.latitude,
    property.longitude,
    rooms,
    buildingYear,
    livingAreaM2,
    monthlyFeeSek,
    askingPriceSek,
    operatingCostsSek,
    energyClass,
    description,
    condition,
    balcony,
    elevator,
    parking,
    garage,
    storage,
    patio,
    broker,
    agency,
  ].filter((v) => v !== null && v !== undefined).length;

  const summaryParts: string[] = [];

  // Generate a meaningful Swedish summary
  if (askingPriceSek !== null) {
    const priceStr = new Intl.NumberFormat("sv-SE").format(Math.round(askingPriceSek));
    summaryParts.push(`${displayAddress(property, streetAddress)} ges ut för ${priceStr} kr`);
    if (livingAreaM2 !== null && pricePerM2Sek !== null) {
      summaryParts[summaryParts.length - 1] += ` (${Math.round(livingAreaM2)} m², ${new Intl.NumberFormat("sv-SE").format(pricePerM2Sek)} kr/m²)`;
    }
    summaryParts[summaryParts.length - 1] += ".";
  } else {
    summaryParts.push(`Analys av ${displayAddress(property, streetAddress)}.`);
  }

  // Verdict context
  const scorePct = Math.round(engineResult.overallConfidence * 100);
  summaryParts.push(`Analysen har ${scorePct}% tillförlitlighet baserat på ${connectedSources} anslutna datakällor.`);

  // Market context
  if (policyRate !== null) {
    summaryParts.push(`Styrräntan är ${policyRate.toFixed(1)}%.`);
  }
  if (populationGrowth !== null) {
    const growthWord = populationGrowth > 1 ? "växer" : populationGrowth > 0 ? "är stabilt" : "minskar";
    summaryParts.push(`Befolkningen i kommunen ${growthWord} (${populationGrowth > 0 ? "+" : ""}${populationGrowth.toFixed(1)}% över 5 år).`);
  }
  if (medianIncome !== null) {
    summaryParts.push(`Medianinkomsten i området är ${Math.round(medianIncome)} tkr.`);
  }

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    factorsAnalyzed,
    property: {
      address: displayAddress(property, streetAddress),
      postalCode: property.postalCode,
      municipality: property.municipality,
      floor,
      apartmentNumber: apartmentNumber ? capitalize(apartmentNumber) : null,
      propertyType: displayPropertyType(propertyType, rooms),
      rooms,
      buildingYear,
      renovationYear,
      housingAssociation: stringOrNull(attributes.housing_association),
      housingAssociationConflict,
      askingPriceSek,
      monthlyFeeSek,
      operatingCostsSek,
      livingAreaM2,
      additionalAreaM2,
      lotAreaM2,
      pricePerM2Sek,
      previousSalePriceSek,
      previousSaleDate,
      mortgageDeed,
      solarPanels,
      fireplace,
      biddingOpen,
      newConstruction,
      energyClass,
      description,
      imageUrls,
      floorplanUrls,
      features,
      condition,
      balcony,
      elevator,
      parking,
      garage,
      storage,
      patio,
      broker,
      agency,
      listingDate,
      ownershipType,
      objectId,
    },
    decisionScore: engineResult.overallScore,
    overallConfidence: engineResult.overallConfidence,
    verdict: engineResult.verdict,
    summary: summaryParts.join(" "),
    insights,
    decisionFactors: engineResult.factors,
    dataSources,
    dataCompleteness: {
      connectedSources,
      totalSources: dataSources.length,
    },
  };
}

function displayAddress(property: PropertyRecord, streetAddress: string): string {
  return property.municipality
    ? `${streetAddress}, ${property.municipality}`
    : streetAddress;
}

function displayPropertyType(propertyType: string | null, rooms: number | null): string | null {
  if (!propertyType) return null;
  if (rooms === null) return propertyType;
  const roomsLabel = Number.isInteger(rooms) ? String(rooms) : rooms.toFixed(1).replace(".", ",");
  return `${propertyType} · ${roomsLabel} rooms`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
