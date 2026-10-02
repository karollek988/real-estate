import type { AnalysisReport, DataSourceReport, ReportFactor } from "@/lib/analysis/types";
// Runtime imports in this file are relative, not "@/..." — build.verify.mjs
// executes it directly with tsx, which does not resolve the "@/" tsconfig
// path alias (type-only "@/..." imports are erased, so those are fine).

/**
 * Turns the facts the analysis collected (the property's own listing facts and
 * the `supportingData` of each factor in lib/analysis/engine/analyzers/*) into
 * the prose and tables the document report renders. This module never invents
 * a fact: every sentence either restates a collected value or explains why a
 * value isn't available yet. It rates nothing — there is no score, verdict or
 * ranking of the home in the report.
 *
 * The BRF chapter is the exception to "automatic": it is written from the
 * figures a Köpanalys reviewer published (brfChapter.ts, lib/brf/), and every
 * chapter that mentions the association takes that chapter's state instead of
 * reading the automatic extraction. The questions chapter lives in
 * questions.ts; the Boendekalkyl chapter is a placeholder until it is built
 * (housingCost.ts holds the verified cost rules it will use).
 *
 * Every reader-facing sentence is composed in Swedish from the collected facts,
 * so the report never leaks raw technical text. Each fact is assigned to
 * exactly one "home" chapter; everywhere else a chapter needs to touch that
 * same fact it points back to the home chapter instead of restating it.
 */

import { NA, capitalize, dateSv, decSv, listSv, num, pct, ratePctSv, sek, sekPerM2, str } from "./format";
import { tenureOf } from "./tenure";
import { brfStatusSentence, dueSv, type BrfChapterState } from "./brfChapter";

export { dateSv, pct, sek, sekPerM2 } from "./format";

export function factor(report: AnalysisReport, id: string): ReportFactor | undefined {
  return report.decisionFactors?.find((f) => f.id === id);
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Source attribution — short, honest, Swedish names for the "Källor"    */
/*  section every chapter ends with. Only sources with status "ok" ever   */
/*  render — this list is never allowed to claim a source that wasn't     */
/*  actually connected for this analysis.                                 */
/* ────────────────────────────────────────────────────────────────────── */

const SHORT_SOURCE_NAMES: Record<string, string> = {
  nominatim_geocoding: "OpenStreetMap",
  hemnet_page_scrape: "Hemnet",
  booli_listing: "Booli",
  scb_area_statistics: "SCB",
  osm_amenities: "OpenStreetMap",
  interest_rates: "Riksbanken",
  smhi_climate: "SMHI",
  infrastructure_projects: "Trafikverket",
  location_intelligence: "Polisen/Kolada/Skolverket m.fl.",
  market_intelligence: "Köpanalys marknadsanalys",
  brf_financials: "Föreningens årsredovisning",
  lantmateriet_address: "Lantmäteriet",
  municipality_plans: "Kommunen",
  skolverket_schools: "Skolverket",
  environmental_data: "Miljödata",
};

/** Friendly, deduped source names actually used ("ok") in a chapter. Pass no
 *  `ids` to list every connected source (used on the summary page). */
export function sourcesUsed(dataSources: DataSourceReport[], ids?: string[]): string[] {
  const pool = ids
    ? ids.map((id) => (dataSources ?? []).find((s) => s.id === id)).filter((s): s is DataSourceReport => !!s)
    : dataSources ?? [];
  const names = pool.filter((s) => s.status === "ok").map((s) => SHORT_SOURCE_NAMES[s.id] ?? s.name);
  return Array.from(new Set(names));
}

/** Swedish explanation for a not-yet-connected source, never the raw
 *  (English) `detail` string a placeholder provider carries internally. */
const NOT_CONNECTED_SV: Record<string, string> = {
  school_ratings: "OpenStreetMap visar bara skolors förekomst, inte Skolverkets betygsresultat.",
  municipality_plans: "kommunala detaljplaner saknar en enhetlig nationell källa att hämta ifrån idag.",
  environmental_data: "flödesrisk, buller och luftkvalitet kräver en separat geodatakälla som inte är kopplad ännu.",
  lantmateriet_address: "kräver en nyckelbaserad koppling mot Lantmäteriet som inte är på plats ännu.",
};

function sourceExplainer(dataSources: DataSourceReport[], sourceId: string, prefix: string): string {
  const source = (dataSources ?? []).find((s) => s.id === sourceId);
  if (!source || source.status === "ok") return prefix;
  const detail = NOT_CONNECTED_SV[sourceId];
  const name = SHORT_SOURCE_NAMES[sourceId] ?? source.name;
  return detail ? `${prefix} ${capitalize(detail)}` : `${prefix} Källan (${name}) är inte ansluten i dagsläget.`;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Executive summary — what the report contains and what is missing      */
/* ────────────────────────────────────────────────────────────────────── */

const UNRESOLVED_TOPIC_SV: Record<string, string> = {
  market: "marknadsläget",
  risk: "riskbilden",
  futureDevelopment: "planerad utveckling i närområdet",
};

export function buildExecutiveSummary(report: AnalysisReport, brf: BrfChapterState): string[] {
  const p = report.property;
  const paragraphs: string[] = [];
  const hasAssociation = brf.kind !== "freehold" && brf.kind !== "not_applicable";

  const priceLine = p.askingPriceSek
    ? `${p.address} är utannonserad för ${sek(p.askingPriceSek)}` +
      (p.livingAreaM2 ? ` (${p.livingAreaM2} m², ${sekPerM2(p.pricePerM2Sek)}).` : ".")
    : `${p.address} analyseras utan ett registrerat utgångspris.`;
  paragraphs.push(
    `${priceLine} Rapporten samlar det som påverkar köpet på ett ställe: ` +
      (hasAssociation ? "föreningens ekonomi, området och riskerna" : "bostaden, området och riskerna") +
      `. Analysen baseras på ${report.dataCompleteness.connectedSources} av ${report.dataCompleteness.totalSources} anslutna datakällor.`
  );

  const brfSentence = brfStatusSentence(brf);
  if (brfSentence) paragraphs.push(brfSentence);

  paragraphs.push(
    "Boendekalkylen — vad bostaden kostar dig varje månad och vid köpet, inklusive avgifter som är lätta att missa — håller på att färdigställas och lanseras inom kort."
  );

  paragraphs.push("Området — service, skolor, pendling och trygghet — beskrivs i kapitlet Områdesanalys.");
  paragraphs.push(
    "Vad som kan påverka området och bostadens värde framöver — ränteläge, sysselsättning och planerad utveckling i " +
      "närområdet — beskrivs i kapitlet Framtidsutsikter."
  );

  const unresolved = Object.keys(UNRESOLVED_TOPIC_SV).filter((id) => !factor(report, id)?.available);
  paragraphs.push(
    unresolved.length > 0
      ? `Följande kunde inte beskrivas fullt ut i denna omgång: ${listSv(
          unresolved.map((id) => UNRESOLVED_TOPIC_SV[id])
        )} — se respektive kapitel för vilka källor som saknas.`
      : "Samtliga delar kunde beskrivas utifrån de datakällor som är anslutna idag."
  );
  paragraphs.push(
    hasAssociation
      ? "Frågor att ställa till mäklaren och föreningen finns i kapitlet Frågor inför visningen."
      : "Frågor att ställa till mäklaren finns i kapitlet Frågor inför visningen."
  );

  return paragraphs.filter((x) => x && x.trim().length > 0);
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Property overview — every field, "Uppgift saknas" instead of hidden   */
/* ────────────────────────────────────────────────────────────────────── */

export interface OverviewRow {
  label: string;
  value: string;
}

export function buildPropertyOverview(
  report: AnalysisReport,
  attributes: Record<string, unknown>
): OverviewRow[] {
  const p = report.property;
  const boolSv = (v: boolean | null) => (v === null ? NA : v ? "Ja" : "Nej");

  return [
    { label: "Adress", value: p.address || NA },
    { label: "Kommun", value: p.municipality ?? str(attributes.municipality) ?? NA },
    { label: "Postnummer", value: p.postalCode ?? NA },
    { label: "Boendetyp", value: p.propertyType ?? NA },
    { label: "Bostadsrättsförening", value: p.housingAssociation ?? str(attributes.housing_association) ?? NA },
    { label: "Lägenhetsnummer", value: p.apartmentNumber ?? NA },
    { label: "Våning", value: p.floor ?? NA },
    { label: "Antal rum", value: p.rooms !== null && p.rooms !== undefined ? String(p.rooms) : NA },
    { label: "Boarea", value: p.livingAreaM2 ? `${p.livingAreaM2} m²` : NA },
    { label: "Biarea", value: p.additionalAreaM2 ? `${p.additionalAreaM2} m²` : NA },
    { label: "Tomtstorlek", value: p.lotAreaM2 ? `${p.lotAreaM2} m²` : NA },
    { label: "Utgångspris", value: sek(p.askingPriceSek) },
    { label: "Pris per m²", value: sekPerM2(p.pricePerM2Sek) },
    { label: "Månadsavgift", value: sek(p.monthlyFeeSek) },
    { label: "Driftskostnader", value: p.operatingCostsSek ? `${sek(p.operatingCostsSek)}/år` : NA },
    { label: "Byggår", value: p.buildingYear ? String(p.buildingYear) : NA },
    { label: "Senaste renovering", value: p.renovationYear ? String(p.renovationYear) : NA },
    { label: "Energiklass", value: p.energyClass ?? NA },
    { label: "Skick", value: p.condition ?? NA },
    { label: "Balkong", value: boolSv(p.balcony) },
    { label: "Uteplats", value: boolSv(p.patio) },
    { label: "Hiss", value: boolSv(p.elevator) },
    { label: "Parkering", value: boolSv(p.parking) },
    { label: "Garage", value: boolSv(p.garage) },
    { label: "Förråd", value: boolSv(p.storage) },
    { label: "Solceller", value: boolSv(p.solarPanels) },
    { label: "Öppen spis", value: boolSv(p.fireplace) },
    { label: "Pantbrev", value: boolSv(p.mortgageDeed) },
    { label: "Nyproduktion", value: boolSv(p.newConstruction) },
    { label: "Öppen budgivning", value: boolSv(p.biddingOpen) },
    { label: "Föregående försäljning", value: p.previousSalePriceSek ? `${sek(p.previousSalePriceSek)}${p.previousSaleDate ? ` (${dateSv(p.previousSaleDate)})` : ""}` : NA },
    { label: "Upplåtelseform", value: p.ownershipType ?? str(attributes.ownership_type) ?? NA },
    { label: "Annonsdatum", value: dateSv(p.listingDate ?? str(attributes.listing_date)) },
    { label: "Objekt-ID", value: p.objectId ?? NA },
    { label: "Planritning", value: (p.floorplanUrls ?? []).length > 0 ? "Ja" : NA },
    { label: "Bekvämligheter", value: (p.features ?? []).length > 0 ? (p.features ?? []).join(", ") : NA },
  ];
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Area analysis chapter — "Is this a good place to live?"              */
/* ────────────────────────────────────────────────────────────────────── */

export interface AmenityRow {
  label: string;
  value: string;
  note: string;
}

export interface CommuteInfo {
  centrumName: string | null;
  centrumCarMinutes: number | null;
  centrumTransitMinutes: number | null;
  centrumWalkMinutes: number | null;
  cityName: string | null;
  cityCarMinutes: number | null;
  cityTransitMinutes: number | null;
}

export interface SchoolResult {
  /** Andel (%) elever med lägst betyget E i samtliga ämnen efter årskurs 9. */
  godkantAllaAmnenPct: number | null;
  /** Andel (%) elever behöriga till gymnasieskolans nationella program. */
  gymnasiebehorighetPct: number | null;
  statisticsYear: string;
}

export interface SchoolRow {
  name: string;
  address: string | null;
  distanceLabel: string;
  huvudman: string | null;
  result: SchoolResult | null;
}

export interface NearbySchools {
  preschools: SchoolRow[];
  primarySchools: SchoolRow[];
  highSchools: SchoolRow[];
  registerDate: string | null;
}

export interface AreaAnalysisContent {
  paragraphs: string[];
  amenities: AmenityRow[];
  commute: CommuteInfo | null;
  schools: NearbySchools | null;
  civicStats: CivicStatsInfo | null;
}

/**
 * Crime/safety and election data, kommun/county-level (never per-address —
 * no such Swedish source exists, see docs/36). Election data is deliberately
 * presented as a bare fact (turnout %) with no framing or derived rating —
 * this product never turns political data into a subjective score.
 */
export interface CivicStatsInfo {
  safetyIndex: number | null;
  recentPoliceEvents: number | null;
  voterTurnoutPct: number | null;
}

/** Null when none of the three Kolada/Polisen-derived signals are present. */
function buildCivicStats(attributes: Record<string, unknown>): CivicStatsInfo | null {
  const safetyIndex = num(attributes.area_safety_index);
  const recentPoliceEvents = num(attributes.area_recent_police_events);
  const voterTurnoutPct = num(attributes.area_voter_turnout_pct);
  if (safetyIndex === null && recentPoliceEvents === null && voterTurnoutPct === null) return null;
  return { safetyIndex, recentPoliceEvents, voterTurnoutPct };
}

/** Null when the commute provider found nothing at all — lets the report
 *  skip the "Pendling" sub-section cleanly rather than show an empty shell. */
function buildCommuteInfo(attributes: Record<string, unknown>): CommuteInfo | null {
  const centrumName = str(attributes.commute_centrum_name);
  const cityName = str(attributes.commute_city_name);
  if (!centrumName && !cityName) return null;
  return {
    centrumName,
    centrumCarMinutes: num(attributes.commute_centrum_car_minutes),
    centrumTransitMinutes: num(attributes.commute_centrum_transit_minutes),
    centrumWalkMinutes: num(attributes.commute_centrum_walk_minutes),
    cityName,
    cityCarMinutes: num(attributes.commute_city_car_minutes),
    cityTransitMinutes: num(attributes.commute_city_transit_minutes),
  };
}

const AMENITY_FIELDS: Array<{ key: string; label: string; note: string }> = [
  { key: "grocery_count_within_1000m", label: "Matbutiker inom 1 km", note: "Antal registrerade i OpenStreetMap." },
  { key: "school_count_within_1000m", label: "Skolor inom 1 km", note: "Förekomst enligt OpenStreetMap — se \"Skolor i närområdet\" nedan för namn, avstånd och betygsresultat." },
  { key: "restaurant_count_within_1000m", label: "Restauranger & caféer inom 1 km", note: "Antal registrerade i OpenStreetMap." },
  { key: "park_count_within_1000m", label: "Parker & grönområden inom 1 km", note: "Antal registrerade i OpenStreetMap." },
  { key: "transit_count_within_1000m", label: "Kollektivtrafikhållplatser inom 1 km", note: "Förekomst, ej tidtabell — se förklaring nedan." },
  { key: "hospital_count_within_1000m", label: "Vårdinrättningar inom 1 km", note: "Antal registrerade i OpenStreetMap." },
];

/** One composed sentence for price trend + population + income — written
 *  once here so it can never also appear, restated, elsewhere in the report
 *  (Framtidsutsikter explicitly points back here instead of repeating). */
function areaContextSv(area: ReportFactor | undefined, attributes: Record<string, unknown>): string {
  const trendPct = num(area?.supportingData.areaPriceTrendPct);
  const trendPeriod = str(area?.supportingData.areaPriceTrendPeriod);
  const popPct = num(area?.supportingData.areaPopulationGrowthPct) ?? num(attributes.area_population_growth_pct);
  const income = num(attributes.median_income_sek_thousands);

  const parts: string[] = [];
  if (trendPct !== null) {
    parts.push(
      `en prisutveckling på ${pct(trendPct)}${trendPeriod ? ` (${trendPeriod})` : ""} bland närliggande sålda bostäder`
    );
  }
  if (popPct !== null) {
    parts.push(`en befolkningsförändring på ${pct(popPct)} de senaste fem åren`);
  }
  if (income !== null) {
    parts.push(`en medianinkomst på ${Math.round(income)} tkr per år`);
  }

  if (parts.length === 0) {
    return "Ingen sammanställd statistik om prisutveckling, befolkning eller inkomst kunde hämtas för området i denna analys.";
  }
  return `Området visar ${listSv(parts)}, vilket ger en bild av det långsiktiga efterfrågeläget.`;
}

export function buildAreaAnalysis(
  report: AnalysisReport,
  attributes: Record<string, unknown>,
  dataSources: DataSourceReport[]
): AreaAnalysisContent {
  const area = factor(report, "area");
  const paragraphs: string[] = [];

  const municipality = report.property.municipality;
  paragraphs.push(
    municipality
      ? `Bostaden ligger i ${municipality}${report.property.postalCode ? ` (${report.property.postalCode})` : ""}. Adressens läge är verifierat mot officiella kartkällor.`
      : "Bostadens läge har inte kunnat verifieras mot en kommun i denna analys, vilket begränsar hur säkert kapitlet nedan kan bedöma området."
  );

  paragraphs.push(areaContextSv(area, attributes));

  const amenities: AmenityRow[] = AMENITY_FIELDS.map(({ key, label, note }) => {
    const value = num(attributes[key]);
    return { label, value: value !== null ? String(value) : NA, note };
  });
  const anyAmenityData = amenities.some((a) => a.value !== NA);
  if (anyAmenityData) {
    paragraphs.push(
      "Närhet till vardagsservice påverkar både boendekvalitet och framtida efterfrågan — tabellen nedan visar vad som finns registrerat inom 1 km, hämtat från OpenStreetMap."
    );
  } else {
    paragraphs.push(sourceExplainer(dataSources, "osm_amenities", "Ingen data om närservice (butiker, skolor, restauranger, kollektivtrafik) kunde hämtas för denna adress i denna körning."));
  }

  const civicStats = buildCivicStats(attributes);
  paragraphs.push(
    civicStats
      ? "Se avsnittet Trygghet & samhälle nedan för statistik om brottslighet och valdeltagande i kommunen."
      : "Statistik om trygghet och brottslighet kunde inte hämtas för denna adress i denna körning (Polisen/Kolada kräver att kommunen är verifierad)."
  );

  const schools = buildNearbySchools(attributes);
  if (schools) {
    paragraphs.push(
      "Betygsresultat (andel godkända i årskurs 9 och andel behöriga till gymnasiet) visas endast för fristående skolor som drivs av en huvudman med enbart en skolenhet i kommunen — för kommunala skolor och skolkedjor med flera enheter finns ännu ingen tillförlitlig skolspecifik statistik i denna analys, se förklaring i kapitlets källor."
    );
  }

  return { paragraphs, amenities, commute: buildCommuteInfo(attributes), schools, civicStats };
}

function distanceLabel(distanceM: number): string {
  return distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(1).replace(".", ",")} km`;
}

interface RawSchoolEntry {
  name?: unknown;
  address?: unknown;
  distanceM?: unknown;
  huvudman?: unknown;
  result?: { godkantAllaAmnenPct?: unknown; gymnasiebehorighetPct?: unknown; statisticsYear?: unknown } | null;
}

function toSchoolRow(entry: RawSchoolEntry): SchoolRow | null {
  const name = str(entry.name);
  const distance = num(entry.distanceM);
  if (!name || distance === null) return null;
  const rawResult = entry.result;
  const godkant = rawResult ? num(rawResult.godkantAllaAmnenPct) : null;
  const behorig = rawResult ? num(rawResult.gymnasiebehorighetPct) : null;
  const result: SchoolResult | null =
    rawResult && (godkant !== null || behorig !== null)
      ? { godkantAllaAmnenPct: godkant, gymnasiebehorighetPct: behorig, statisticsYear: str(rawResult.statisticsYear) ?? "" }
      : null;
  return { name, address: str(entry.address), distanceLabel: distanceLabel(distance), huvudman: str(entry.huvudman), result };
}

function schoolRows(value: unknown): SchoolRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (v && typeof v === "object" ? toSchoolRow(v as RawSchoolEntry) : null))
    .filter((r): r is SchoolRow => r !== null);
}

/** Null when none of the three school sources (Skolverket + OSM) returned
 *  anything — lets the report skip the "Skolor i närområdet" sub-section
 *  cleanly rather than show an empty shell. */
function buildNearbySchools(attributes: Record<string, unknown>): NearbySchools | null {
  const preschools = schoolRows(attributes.nearby_preschools);
  const primarySchools = schoolRows(attributes.nearby_primary_schools);
  const highSchools = schoolRows(attributes.nearby_high_schools);
  if (preschools.length === 0 && primarySchools.length === 0 && highSchools.length === 0) return null;
  return { preschools, primarySchools, highSchools, registerDate: str(attributes.schools_register_extract_date) };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Risk assessment — "What are the biggest risks?" — 8 named categories */
/* ────────────────────────────────────────────────────────────────────── */

export interface RiskCategory {
  id: string;
  label: string;
  headline: string;
  explanation: string;
  evidence: string[];
  conclusion: string;
}

/** Each of these composes a fresh Swedish sentence straight from risk.ts's
 *  supportingData (buildingYear, policyRatePct, ...). A category is only ever
 *  an observation about a collected fact — there is no severity or rating. */
function riskBuildingAgeSv(risk: ReportFactor | undefined): string {
  const buildingYear = num(risk?.supportingData.buildingYear);
  if (buildingYear === null) return "Byggår saknas för denna bostad, så underhållsrisken kan inte bedömas.";
  const age = num(risk?.supportingData.buildingAgeYears) ?? new Date().getFullYear() - buildingYear;
  const renovationYear = num(risk?.supportingData.renovationYear);
  return renovationYear !== null
    ? `Byggnaden uppfördes ${buildingYear} (${age} år gammal), med en senare större renovering ${renovationYear}.`
    : `Byggnaden uppfördes ${buildingYear} (${age} år gammal); inga större renoveringar är kända.`;
}

function riskInterestRateSv(risk: ReportFactor | undefined): string {
  const rate = num(risk?.supportingData.policyRatePct);
  if (rate === null) return "Ingen aktuell styrränta är kopplad till denna analys.";
  const note =
    rate > 3
      ? "Ett högt ränteläge ökar generellt refinansieringskostnaderna för både föreningen och de boende."
      : rate < 1.5
        ? "Ett lågt ränteläge håller generellt refinansieringskostnaderna på en mer hanterbar nivå."
        : "Styrräntan ligger för närvarande på en måttlig nivå.";
  return `Aktuell styrränta är ${ratePctSv(rate)}. ${note}`;
}

function riskPopulationSv(risk: ReportFactor | undefined): string {
  const pop = num(risk?.supportingData.areaPopulationGrowthPct);
  if (pop === null) return "Ingen befolkningsstatistik är kopplad till denna analys.";
  return (
    `Befolkningen i kommunen har ${pop >= 0 ? "ökat" : "minskat"} med ${decSv(Math.abs(pop))} % de senaste fem åren. ` +
    "Befolkningstillväxt förknippas generellt med starkare efterfrågan på bostäder, medan en minskande befolkning generellt förknippas med svagare efterfrågan."
  );
}

function riskAmenitySv(risk: ReportFactor | undefined): string {
  const counts = risk?.supportingData.amenityCounts as { grocery?: number; transit?: number } | undefined;
  if (!counts) return "Ingen data om närservice är kopplad till denna adress i denna analys.";
  const grocery = counts.grocery ?? 0;
  const transit = counts.transit ?? 0;
  const notes: string[] = [];
  if (grocery <= 1) notes.push(`${grocery} matbutik${grocery === 1 ? "" : "er"} registrerad${grocery === 1 ? "" : "e"} inom 1 km`);
  if (transit <= 2) notes.push(`${transit} kollektivtrafikhållplats${transit === 1 ? "" : "er"} registrerad${transit === 1 ? "" : "e"} inom 1 km`);
  return notes.length > 0
    ? `Begränsad närservice registrerad: ${listSv(notes)}.`
    : `${grocery} matbutiker och ${transit} kollektivtrafikhållplatser är registrerade inom 1 km.`;
}

function riskNoiseSv(risk: ReportFactor | undefined): string {
  const highway = num(risk?.supportingData.highwayProximity);
  if (highway === null) return "Ingen data om vägbuller är kopplad till denna adress.";
  return (
    `${highway} större väg${highway === 1 ? "" : "ar"} registrerad${highway === 1 ? "" : "e"} inom 1 km. ` +
    "Närhet till större vägar förknippas generellt med högre bullerexponering och sämre luftkvalitet."
  );
}

export function buildRiskCategories(
  report: AnalysisReport,
  dataSources: DataSourceReport[],
  brf: BrfChapterState
): RiskCategory[] {
  const risk = factor(report, "risk");
  const future = factor(report, "futureDevelopment");
  const hasAssociation = brf.kind === "awaiting" || brf.kind === "published";
  const reading = brf.kind === "published" ? brf.reading : null;
  const signal = (id: string) =>
    reading ? [...reading.keyFigures, ...reading.loans, ...reading.association].find((s) => s.id === id) ?? null : null;
  const awaitingLine =
    brf.kind === "awaiting"
      ? `Bedöms i BRF-analysen, som granskas av Köpanalys experter och publiceras ${dueSv(brf.dueAt) && !brf.overdue ? `senast ${dueSv(brf.dueAt)}` : "så snart den är klar"}.`
      : null;
  const riskData = risk?.supportingData ?? {};

  const categories: RiskCategory[] = [];

  // 1. Market risk (population trend only — rate/employment live in Framtidsutsikter)
  {
    const hasPopulation = num(riskData.areaPopulationGrowthPct) !== null;
    categories.push({
      id: "market",
      label: "Marknadsrisk",
      headline: "Efterfrågan på orten",
      explanation: hasPopulation
        ? `${riskPopulationSv(risk)} En bredare marknadsbild (ränteläge, sysselsättning) finns i kapitlet Framtidsutsikter.`
        : "Inga marknadsindikatorer är kopplade till denna analys ännu.",
      evidence: [],
      conclusion: hasPopulation
        ? "Efterfrågeläget på orten är en faktor att väga in tillsammans med de övriga observationerna i denna analys."
        : "Kan inte bedömas utan mer marknadsdata.",
    });
  }

  // 2. Interest rate risk — the policy rate, and the association's sensitivity once the BRF analysis is published
  {
    const hasRate = num(riskData.policyRatePct) !== null;
    const sensitivity = signal("interestSensitivity");
    categories.push({
      id: "interest_rate",
      label: "Ränterisk",
      headline: "Känslighet för förändrat ränteläge",
      explanation:
        (hasRate ? riskInterestRateSv(risk) : "Ingen aktuell styrränta är kopplad till denna analys.") +
        (sensitivity ? ` ${sensitivity.meaning}` : ""),
      evidence: [],
      conclusion: hasRate || sensitivity
        ? "Ränteläget påverkar både ditt eget bolån och föreningens kostnader, och därmed den löpande boendekostnaden."
        : "Kan inte bedömas utan ränteuppgifter.",
    });
  }

  // 3. Housing association risk (only for homes that have an association)
  if (hasAssociation) {
    const concerns = reading?.concerns ?? [];
    categories.push({
      id: "housing_association",
      label: "Föreningsrisk",
      headline: "Föreningens ekonomiska stabilitet",
      explanation: reading
        ? concerns.length > 0
          ? `BRF-analysen pekar ut ${concerns.length} ${concerns.length === 1 ? "punkt" : "punkter"} i föreningens ekonomi som är ${concerns.length === 1 ? "värd" : "värda"} en närmare titt.`
          : "Inget av föreningens nyckeltal ligger utanför de nivåer som brukar räknas som normala."
        : awaitingLine!,
      evidence: concerns,
      conclusion: reading
        ? "Kapitlet Bostadsrättsförening förklarar varje nyckeltal och vad det betyder för dig."
        : "Föreningens ekonomi beskrivs i kapitlet Bostadsrättsförening när granskningen är klar.",
    });
  }

  // 4. Area risk
  {
    const hasAmenities = risk?.supportingData.amenityCounts !== undefined;
    categories.push({
      id: "area",
      label: "Områdesrisk",
      headline: "Service, tillgänglighet och läge",
      explanation: hasAmenities ? riskAmenitySv(risk) : "Ingen data om närservice är kopplad till denna adress i denna analys.",
      evidence: [],
      conclusion: hasAmenities
        ? "Närservicen påverkar vardagen och kan vara värd att uppleva på plats vid ett besök."
        : "Kan inte bedömas utan data om närservice.",
    });
  }

  // 5. Fee risk — what could raise the monthly fee (BRF)
  if (hasAssociation) {
    const drivers = reading
      ? [
          signal("feeChange")?.tone === "watch" ? signal("feeChange") : null,
          signal("pipes")?.tone === "watch" ? signal("pipes") : null,
          signal("plannedRenovations"),
          signal("land")?.value === "Tomträtt" ? signal("land") : null,
          signal("savings")?.tone === "watch" || signal("savings")?.tone === "alert" ? signal("savings") : null,
          signal("interestSensitivity")?.tone === "watch" || signal("interestSensitivity")?.tone === "alert"
            ? signal("interestSensitivity")
            : null,
        ].filter((s): s is NonNullable<typeof s> => s !== null)
      : [];
    categories.push({
      id: "fee",
      label: "Avgiftsrisk",
      headline: "Risk för höjd månadsavgift",
      explanation: reading
        ? drivers.length > 0
          ? "Det här i föreningens årsredovisning kan påverka avgiften framöver:"
          : "Inga beslutade avgiftshöjningar, planerade större åtgärder eller svaga nyckeltal framgår av årsredovisningen."
        : awaitingLine!,
      evidence: drivers.map((d) => d.summary),
      conclusion: reading
        ? "Vad en ränte- eller avgiftshöjning skulle betyda i kronor för den här lägenheten står under Vad det betyder för dig i kapitlet Bostadsrättsförening."
        : "Avgiftsrisken beskrivs när BRF-analysen är publicerad.",
    });
  }

  // 6. Environmental risk
  {
    const hasNoise = num(riskData.highwayProximity) !== null;
    const envSource = (dataSources ?? []).find((s) => s.id === "environmental_data");
    categories.push({
      id: "environmental",
      label: "Miljörisk",
      headline: "Buller, luftkvalitet och översvämningsrisk",
      explanation:
        (hasNoise ? riskNoiseSv(risk) : "Ingen data om vägbuller är kopplad till denna adress.") +
        (envSource && envSource.status !== "ok" ? ` ${capitalize(NOT_CONNECTED_SV.environmental_data)}` : ""),
      evidence: [],
      conclusion: hasNoise
        ? "Buller- och miljöexponering kan vara värt att uppleva på plats, gärna vid olika tider på dygnet."
        : "Endast delvis kartlagt — se ovan.",
    });
  }

  // 7. Construction / building risk — building age, and the pipes once the BRF analysis is published
  {
    const hasAge = num(riskData.buildingYear) !== null;
    const pipes = signal("pipes");
    categories.push({
      id: "construction",
      label: "Byggnadsrisk",
      headline: "Byggnadens ålder och underhållsbehov",
      explanation:
        (hasAge ? riskBuildingAgeSv(risk) : "Byggår saknas för denna bostad, så underhållsrisk kan inte bedömas.") +
        (pipes ? ` ${pipes.summary}.` : ""),
      evidence: [],
      conclusion: hasAge
        ? "Byggnadens ålder och skick kan vara värt att undersöka närmare, till exempel via en besiktning."
        : "Kräver uppgift om byggår.",
    });
  }

  // 8. Future uncertainty
  {
    const count = num(future?.supportingData.nearbyPlannedProjectsCount);
    categories.push({
      id: "future",
      label: "Framtidsosäkerhet",
      headline: "Osäkerhet i prognoser och planer",
      explanation:
        count !== null
          ? `${count === 1 ? "1 planerat eller pågående utvecklingsprojekt är känt" : `${count} planerade eller pågående utvecklingsprojekt är kända`} i närområdet — de beskrivs i kapitlet Framtidsutsikter. Denna kategori beskriver istället den generella osäkerheten i framtidsprognoser.`
          : "Ingen data om planerad utveckling i området är kopplad till denna analys.",
      evidence: [],
      conclusion:
        "Alla framåtblickande beskrivningar i denna rapport bygger på idag kända planer och trender — oförutsedda politiska, ekonomiska eller lokala beslut kan förändra bilden.",
    });
  }

  return categories;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Investment outlook — "What could increase or decrease future value?" */
/* ────────────────────────────────────────────────────────────────────── */

export interface InvestmentOutlookContent {
  paragraphs: string[];
  futureProjects: string[];
}

/** Rate + employment only — population/income/price-trend are Area's own
 *  facts (areaContextSv) and are deliberately not restated here. */
function marketOutlookSv(market: ReportFactor | undefined): string {
  const rateChange = num(market?.supportingData.policyRateChangePctPoints);
  const currentRate = num(market?.supportingData.currentPolicyRatePct);
  const employment = num(market?.supportingData.municipalityEmploymentRatePct);
  const parts: string[] = [];

  if (rateChange !== null) {
    parts.push(
      rateChange < -0.25
        ? `Styrräntan har sänkts med ${decSv(Math.abs(rateChange), 2)} procentenheter det senaste året, vilket normalt stärker efterfrågan på bostäder.`
        : rateChange > 0.25
          ? `Styrräntan har höjts med ${decSv(rateChange, 2)} procentenheter det senaste året, vilket normalt dämpar efterfrågan.`
          : `Styrräntan har varit relativt stabil${currentRate !== null ? ` (${ratePctSv(currentRate)})` : ""}.`
    );
  }
  if (employment !== null) {
    parts.push(`Kommunens sysselsättningsgrad är ${decSv(employment)} %.`);
  }

  if (parts.length === 0) {
    return "Makroekonomiska indikatorer (ränteläge, sysselsättning) är i dagsläget för begränsade för att ge en tillförlitlig marknadsprognos.";
  }
  return parts.join(" ");
}

function futureProjectsOutlookSv(future: ReportFactor | undefined): string {
  const count = num(future?.supportingData.nearbyPlannedProjectsCount);
  if (count === null) return "Ingen information om planerade infrastruktur- eller utvecklingsprojekt är kopplad till denna analys.";
  if (count === 0) return "Inga planerade eller pågående utvecklingsprojekt hittades i närområdet i de källor som är anslutna idag.";
  return (
    `${count === 1 ? "1 planerat eller pågående utvecklingsprojekt har" : `${count} planerade eller pågående utvecklingsprojekt har`} identifierats i närområdet. ` +
    "Nya infrastruktur- och utvecklingsprojekt i ett område förknippas generellt med en förändrad efterfrågan och prisnivå över tid."
  );
}

export function buildInvestmentOutlook(report: AnalysisReport): InvestmentOutlookContent {
  const future = factor(report, "futureDevelopment");
  const market = factor(report, "market");
  const paragraphs: string[] = [];

  paragraphs.push(
    "Den här sidan fokuserar på vad som kan påverka området och bostadens värde framöver. För nuvarande prisläge, " +
      "befolkningsutveckling och inkomstnivå i området, se kapitlet Områdesanalys."
  );
  paragraphs.push(marketOutlookSv(market));
  paragraphs.push(futureProjectsOutlookSv(future));
  paragraphs.push(
    "Prognoser om framtida värdeutveckling är alltid förenade med osäkerhet — ränteläge, makroekonomi och lokalt utbud/efterfrågan " +
      "kan förändras på sätt som inte syns i dagens data. Bedömningen ovan ska läsas som en nulägesbild, inte en garanti."
  );

  // OpenStreetMap construction sites without a name come through as
  // "unnamed construction site" — a placeholder, not something to list.
  const projects = Array.isArray(future?.supportingData.nearbyPlannedProjects)
    ? (future?.supportingData.nearbyPlannedProjects as unknown[]).filter(
        (p): p is string => typeof p === "string" && p.trim() !== "" && !/^unnamed\b/i.test(p.trim())
      )
    : [];

  return { paragraphs: paragraphs.filter((p) => p && p.trim().length > 0), futureProjects: projects };
}
