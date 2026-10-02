import type { AnalysisReport, DataSourceReport, ReportFactor } from "@/lib/analysis/types";
import type { BrfReportState } from "@/lib/analysis/engine/analyzers/housingAssociation";
// Runtime imports in this file are relative, not "@/..." — build.verify.mjs
// executes it directly with tsx, which does not resolve the "@/" tsconfig
// path alias (type-only "@/..." imports are erased, so those are fine).

/**
 * Turns the facts the analysis collected (the property's own listing facts and
 * the `supportingData` of each factor in lib/analysis/engine/analyzers/*) into
 * the prose and tables the document report renders. This module never invents
 * a fact: every sentence either restates a collected value or explains why a
 * value isn't available yet. It rates nothing — there is no score, verdict or
 * ranking in the report; the "Boendekalkyl" chapter lives in housingCost.ts.
 *
 * Every reader-facing sentence is composed in Swedish from the collected facts,
 * so the report never leaks raw technical text. Each fact is assigned to
 * exactly one "home" chapter; everywhere else a chapter needs to touch that
 * same fact it points back to the home chapter instead of restating it.
 */

import { NA, capitalize, dateSv, listSv, num, pct, sek, sekPerM2, str } from "./format";
import { tenureOf } from "./tenure";
import { INTEREST_SCENARIOS_PCT, buildHousingCost } from "./housingCost";

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

/** What the report knows about the BRF annual report the buyer uploaded (see analyzers/housingAssociation.ts). */
export function brfReportStateOf(report: AnalysisReport): BrfReportState {
  const state = factor(report, "housingAssociation")?.supportingData.reportState;
  return state === "verified" || state === "unusable" ? state : "none";
}

const UNRESOLVED_TOPIC_SV: Record<string, string> = {
  market: "marknadsläget",
  risk: "riskbilden",
  futureDevelopment: "planerad utveckling i närområdet",
};

export function buildExecutiveSummary(report: AnalysisReport, attributes: Record<string, unknown> = {}): string[] {
  const p = report.property;
  const paragraphs: string[] = [];

  const priceLine = p.askingPriceSek
    ? `${p.address} är utannonserad för ${sek(p.askingPriceSek)}` +
      (p.livingAreaM2 ? ` (${p.livingAreaM2} m², ${sekPerM2(p.pricePerM2Sek)}).` : ".")
    : `${p.address} analyseras utan ett registrerat utgångspris.`;
  paragraphs.push(
    `${priceLine} Rapporten samlar föreningens ekonomi, boendekostnaderna och området på ett ställe. ` +
      `Analysen baseras på ${report.dataCompleteness.connectedSources} av ${report.dataCompleteness.totalSources} anslutna datakällor.`
  );

  // The association: only for homes that have one.
  if (tenureOf(p) !== "freehold") {
    const brfState = brfReportStateOf(report);
    const fiscalYear = num(factor(report, "housingAssociation")?.supportingData.fiscalYear);
    paragraphs.push(
      brfState === "verified"
        ? `Föreningens ekonomi bygger på årsredovisningen${fiscalYear ? ` för ${fiscalYear}` : ""} som har laddats upp — nyckeltalen finns i kapitlet Bostadsrättsförening.`
        : brfState === "unusable"
          ? "En årsredovisning har laddats upp men gick inte att läsa ut tillräckligt säkert, så föreningens ekonomi kan inte visas — se kapitlet Bostadsrättsförening."
          : "Ingen årsredovisning har laddats upp för föreningen än, så föreningens ekonomi visas inte. Årsredovisningen laddas upp i kapitlet Bostadsrättsförening, och rapporten uppdateras då."
    );
  }

  const cost = buildHousingCost(report, attributes);
  if (cost.summaryRange) {
    paragraphs.push(
      `Boendekalkylen uppskattar den totala månadskostnaden — ${cost.fixedMonthlySek !== null ? "avgift eller driftskostnader samt " : ""}ränta och amortering på ett lån på ${cost.loan?.loanToValuePct} % av priset — ` +
        `till ${sek(cost.summaryRange.minPerMonthSek)}–${sek(cost.summaryRange.maxPerMonthSek)} per månad vid en ränta på ${INTEREST_SCENARIOS_PCT[0]}–${INTEREST_SCENARIOS_PCT[INTEREST_SCENARIOS_PCT.length - 1]} %. ` +
        "Kapitlet beskriver också vad som tillkommer vid köpet."
    );
  } else {
    paragraphs.push("Boendekalkylen beskriver bostadens löpande kostnader och vad som tillkommer vid köpet, i den mån annonsen anger dem.");
  }

  paragraphs.push("Området — service, skolor, pendling och trygghet — beskrivs i kapitlet Områdesanalys.");
  paragraphs.push(
    "Vad som kan påverka bostadens värde framöver — ränteläge, sysselsättning och planerad utveckling i " +
      "närområdet — beskrivs i kapitlet Investeringsutsikt."
  );

  const unresolved = Object.keys(UNRESOLVED_TOPIC_SV).filter((id) => !factor(report, id)?.available);
  paragraphs.push(
    unresolved.length > 0
      ? `Följande kunde inte beskrivas fullt ut i denna omgång: ${listSv(
          unresolved.map((id) => UNRESOLVED_TOPIC_SV[id])
        )} — se respektive kapitel för vilka källor som saknas.`
      : "Samtliga delar kunde beskrivas utifrån de datakällor som är anslutna idag."
  );
  paragraphs.push("Frågor att ställa till mäklaren och föreningen finns i kapitlet Frågor inför visningen.");

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
 *  (Investeringsutsikt explicitly points back here instead of repeating). */
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
/*  Housing association chapter — the association's finances in plain     */
/*  language, from the annual report the buyer uploaded                   */
/* ────────────────────────────────────────────────────────────────────── */

export interface BrfContent {
  paragraphs: string[];
  metrics: OverviewRow[];
  strengths: string[];
  weaknesses: { text: string; severity?: string }[];
  /** What the chapter knows about the buyer-uploaded annual report: drives the upload prompt. */
  reportState: BrfReportState;
}

const SEVERITY_SV: Record<string, string> = {
  minor: "mindre",
  moderate: "måttlig",
  significant: "betydande",
  critical: "kritisk",
};

/** Swedish summary of the BRF's financial picture — composed from the collected facts only. */
function brfSummarySv(state: BrfReportState, brf: ReportFactor | undefined, brfName: string | null): string {
  if (state === "unusable") {
    return (
      (brfName ? `${brfName}: en` : "En") +
      " årsredovisning har laddats upp, men siffrorna i den gick inte att läsa ut tillräckligt säkert (till exempel för att dokumentet är en inskannad bild med låg kvalitet eller har en ovanlig layout) " +
      "och har därför inte använts — vi visar hellre inga siffror än fel siffror. En ny fil, till exempel en textbaserad PDF, kan laddas upp nedan."
    );
  }

  if (state === "none") {
    return (
      (brfName ? `Ekonomin i ${brfName}` : "Föreningens ekonomi") +
      " bygger på föreningens årsredovisning, och ingen årsredovisning har laddats upp än. " +
      "Ladda upp den nedan (PDF, Word eller foto) så läser vi av nyckeltalen och uppdaterar rapporten. Årsredovisningen får du av mäklaren eller föreningen."
    );
  }

  const d = brf?.supportingData ?? {};
  const findings = (d.findings as Array<{ classification: string }> | undefined) ?? [];
  const strengthsCount = findings.filter((f) => f.classification === "strength").length;
  const weaknessesCount = findings.filter((f) => f.classification === "weakness").length;
  const fiscalYear = d.fiscalYear ? String(d.fiscalYear) : null;
  const source = `föreningens${fiscalYear ? ` årsredovisning för ${fiscalYear}` : " senaste årsredovisning"}`;

  if (strengthsCount + weaknessesCount === 0) {
    return `Ur ${source} har de nyckeltal nedan kunnat läsas ut och kontrolleras. Underlaget räckte inte för att dra slutsatser om föreningens styrkor och svagheter.`;
  }
  return (
    `Den ekonomiska analysen av ${source} ` +
    `visar ${strengthsCount} styrk${strengthsCount === 1 ? "a" : "or"} och ${weaknessesCount} svaghet${weaknessesCount === 1 ? "" : "er"}, ` +
    "inom bland annat soliditet, skuldsättning, avgiftsnivå och likviditet — se nyckeltalen nedan."
  );
}

export function buildHousingAssociation(report: AnalysisReport, _dataSources?: DataSourceReport[]): BrfContent {
  const brf = factor(report, "housingAssociation");
  const state = brfReportStateOf(report);
  const paragraphs: string[] = [];
  const metrics: OverviewRow[] = [];
  let strengths: string[] = [];
  let weaknesses: { text: string; severity?: string }[] = [];

  const brfName = report.property.housingAssociation;
  paragraphs.push(
    brfName
      ? `Bostaden tillhör ${brfName}.`
      : "Ingen bostadsrättsförening har kunnat identifieras för denna adress i denna analys."
  );

  const conflict = report.property.housingAssociationConflict;
  if (conflict) {
    paragraphs.push(
      `Observera: datakällorna är oense om föreningens namn. Vi har använt "${conflict.keptValue}", ` +
        `medan en annan källa (${conflict.rejectedSource}) angav "${conflict.rejectedValue}" — kontrollera namnet mot föreningens stadgar.`
    );
  }

  paragraphs.push(brfSummarySv(state, brf, brfName));

  if (state === "verified" && brf) {
    const d = brf.supportingData;
    if (typeof d.equityRatio === "number") metrics.push({ label: "Soliditet", value: pct(d.equityRatio * 100, 0) });
    if (typeof d.operatingMargin === "number") metrics.push({ label: "Rörelsemarginal", value: pct(d.operatingMargin * 100, 0) });
    if (typeof d.debtPerApartment === "number") metrics.push({ label: "Skuld per lägenhet", value: sek(d.debtPerApartment) });
    if (typeof d.feeSustainability === "number") metrics.push({ label: "Avgiftsnivå (index)", value: String(d.feeSustainability) });
    if (typeof d.liquidityMonths === "number") metrics.push({ label: "Likviditet", value: `${d.liquidityMonths} månader` });
    if (typeof d.debtRatio === "number") metrics.push({ label: "Skuldandel", value: pct(d.debtRatio * 100, 0) });
    if (typeof d.debtToEquity === "number") metrics.push({ label: "Skuld/eget kapital", value: `${d.debtToEquity.toFixed(2)}x` });
    if (typeof d.totalDebt === "number") metrics.push({ label: "Total låneskuld", value: sek(d.totalDebt) });
    if (typeof d.weightedAverageInterest === "number") metrics.push({ label: "Vägt genomsnittlig ränta", value: pct(d.weightedAverageInterest, 2) });
    if (typeof d.shortTermDebtRatio === "number") metrics.push({ label: "Andel kortfristig skuld", value: pct(d.shortTermDebtRatio * 100, 0) });
    if (typeof d.costPerSqm === "number") metrics.push({ label: "Driftskostnad per m²", value: sekPerM2(d.costPerSqm) });
    if (typeof d.numberOfRentalApartments === "number") metrics.push({ label: "Hyresrätter i föreningen", value: String(d.numberOfRentalApartments) });
    if (typeof d.numberOfCommercialUnits === "number") metrics.push({ label: "Kommersiella lokaler", value: String(d.numberOfCommercialUnits) });
    if (typeof d.parkingSpaces === "number") metrics.push({ label: "Parkeringsplatser", value: String(d.parkingSpaces) });
    if (typeof d.garageSpaces === "number") metrics.push({ label: "Garageplatser", value: String(d.garageSpaces) });

    if (typeof d.debtPerApartment === "number" || typeof d.debtRatio === "number" || typeof d.totalDebt === "number") {
      paragraphs.push(
        "Högre skuldsättning innebär generellt en högre känslighet för framtida ränteförändringar, eftersom en större andel av föreningens kostnader då är rörliga snarare än bundna."
      );
    }

    const findings = d.findings as Array<{ dimension: string; classification: string; severity?: string; summary: string }> | undefined;
    if (findings) {
      strengths = findings.filter((f) => f.classification === "strength").map((f) => f.summary);
      weaknesses = findings
        .filter((f) => f.classification === "weakness")
        .map((f) => ({ text: f.summary, severity: f.severity && f.severity !== "minor" ? SEVERITY_SV[f.severity] : undefined }));
    }
  }

  if (metrics.length === 0) {
    metrics.push({
      label: "Finansiella nyckeltal",
      value:
        state === "unusable"
          ? "Inga verifierade nyckeltal kunde läsas ut ur den uppladdade årsredovisningen."
          : "Inga nyckeltal än — ladda upp föreningens årsredovisning för att få dem.",
    });
  }

  return { paragraphs, metrics, strengths, weaknesses, reportState: state };
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

const DIMENSION_SV: Record<string, string> = {
  financial_health: "ekonomisk hälsa",
  debt_sustainability: "skuldsättning",
  fee_analysis: "avgiftsnivå",
  liquidity: "likviditet",
};

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
  return `Aktuell styrränta är ${rate.toFixed(1)}%. ${note}`;
}

function riskPopulationSv(risk: ReportFactor | undefined): string {
  const pop = num(risk?.supportingData.areaPopulationGrowthPct);
  if (pop === null) return "Ingen befolkningsstatistik är kopplad till denna analys.";
  return (
    `Befolkningen i kommunen har ${pop >= 0 ? "ökat" : "minskat"} med ${Math.abs(pop).toFixed(1)}% de senaste fem åren. ` +
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

export function buildRiskCategories(report: AnalysisReport, dataSources: DataSourceReport[]): RiskCategory[] {
  const risk = factor(report, "risk");
  const brf = factor(report, "housingAssociation");
  const future = factor(report, "futureDevelopment");
  const brfState = brfReportStateOf(report);
  const hasAssociation = tenureOf(report.property) !== "freehold";
  const riskData = risk?.supportingData ?? {};

  const categories: RiskCategory[] = [];

  // 1. Market risk (population trend only — rate/employment live in Investeringsutsikt)
  {
    const hasPopulation = num(riskData.areaPopulationGrowthPct) !== null;
    categories.push({
      id: "market",
      label: "Marknadsrisk",
      headline: "Efterfrågan på orten",
      explanation: hasPopulation
        ? `${riskPopulationSv(risk)} En bredare marknadsbild (ränteläge, sysselsättning) finns i kapitlet Investeringsutsikt.`
        : "Inga marknadsindikatorer är kopplade till denna analys ännu.",
      evidence: [],
      conclusion: hasPopulation
        ? "Efterfrågeläget på orten är en faktor att väga in tillsammans med de övriga observationerna i denna analys."
        : "Kan inte bedömas utan mer marknadsdata.",
    });
  }

  // 2. Interest rate risk
  {
    const hasRate = num(riskData.policyRatePct) !== null;
    categories.push({
      id: "interest_rate",
      label: "Ränterisk",
      headline: "Känslighet för förändrat ränteläge",
      explanation: hasRate ? riskInterestRateSv(risk) : "Ingen aktuell styrränta är kopplad till denna analys.",
      evidence: [],
      conclusion: hasRate
        ? "Ränteläget påverkar den löpande boendekostnaden och kan vara värt att stämma av med en långivare eller rådgivare."
        : "Kan inte bedömas utan ränteuppgifter.",
    });
  }

  // 3. Housing association risk (only for homes that have an association)
  if (hasAssociation) {
    const findings = (brf?.supportingData.findings as Array<{ dimension: string; classification: string; severity?: string; summary: string }> | undefined) ?? [];
    const weaknesses = findings.filter((f) => f.classification === "weakness");
    categories.push({
      id: "housing_association",
      label: "Föreningsrisk",
      headline: "Föreningens ekonomiska stabilitet",
      explanation:
        brfState === "verified"
          ? `${weaknesses.length} svaghet${weaknesses.length === 1 ? "" : "er"} identifierad${weaknesses.length === 1 ? "" : "e"} i föreningens årsredovisning. Se kapitlet Bostadsrättsförening för en fullständig genomgång.`
          : brfState === "unusable"
            ? "Föreningens ekonomi kunde inte bedömas — den uppladdade årsredovisningen gick inte att läsa ut tillräckligt säkert."
            : "Föreningens ekonomi kunde inte bedömas eftersom ingen årsredovisning har laddats upp.",
      evidence: [],
      conclusion:
        brfState === "verified"
          ? "Föreningens ekonomi är värd att undersöka vidare, till exempel genom att läsa hela årsredovisningen."
          : "Kräver föreningens årsredovisning för en säker bedömning.",
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

  // 5. Liquidity risk (BRF)
  if (hasAssociation) {
    const liquidityMonths = num(brf?.supportingData.liquidityMonths);
    categories.push({
      id: "liquidity",
      label: "Likviditetsrisk",
      headline: "Föreningens kassalikviditet",
      explanation:
        liquidityMonths !== null
          ? `Föreningen har en uppskattad likviditetsbuffert motsvarande ${liquidityMonths} månaders löpande kostnader.`
          : "Föreningens likviditet (kassabuffert) kunde inte beräknas — det kräver en läsbar årsredovisning, som inte har laddats upp för denna förening.",
      evidence: [],
      conclusion:
        liquidityMonths !== null
          ? "Föreningens likviditet kan vara värd att fråga föreningen eller mäklaren om vid behov."
          : "Kräver en läsbar årsredovisning.",
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

  // 7. Construction / building risk
  {
    const hasAge = num(riskData.buildingYear) !== null;
    categories.push({
      id: "construction",
      label: "Byggnadsrisk",
      headline: "Byggnadens ålder och underhållsbehov",
      explanation: hasAge ? riskBuildingAgeSv(risk) : "Byggår saknas för denna bostad, så underhållsrisk kan inte bedömas.",
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
          ? `${count} planerat eller pågående utvecklingsprojekt är känt i närområdet — dessa beskrivs i kapitlet Investeringsutsikt. Denna kategori beskriver istället den generella osäkerheten i framtidsprognoser.`
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
        ? `Styrräntan har sänkts med ${Math.abs(rateChange).toFixed(2)} procentenheter det senaste året, vilket normalt stärker efterfrågan på bostäder.`
        : rateChange > 0.25
          ? `Styrräntan har höjts med ${rateChange.toFixed(2)} procentenheter det senaste året, vilket normalt dämpar efterfrågan.`
          : `Styrräntan har varit relativt stabil${currentRate !== null ? ` (${currentRate.toFixed(1)}%)` : ""}.`
    );
  }
  if (employment !== null) {
    parts.push(`Kommunens sysselsättningsgrad är ${employment.toFixed(1)}%.`);
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
    `${count} planerat eller pågående utvecklingsprojekt har identifierats i närområdet. ` +
    "Nya infrastruktur- och utvecklingsprojekt i ett område förknippas generellt med en förändrad efterfrågan och prisnivå över tid."
  );
}

export function buildInvestmentOutlook(report: AnalysisReport): InvestmentOutlookContent {
  const future = factor(report, "futureDevelopment");
  const market = factor(report, "market");
  const paragraphs: string[] = [];

  paragraphs.push(
    "Den här sidan fokuserar på vad som specifikt kan påverka bostadens värde framöver. För nuvarande prisläge, " +
      "befolkningsutveckling och inkomstnivå i området, se kapitlet Områdesanalys."
  );
  paragraphs.push(marketOutlookSv(market));
  paragraphs.push(futureProjectsOutlookSv(future));
  paragraphs.push(
    "Prognoser om framtida värdeutveckling är alltid förenade med osäkerhet — ränteläge, makroekonomi och lokalt utbud/efterfrågan " +
      "kan förändras på sätt som inte syns i dagens data. Bedömningen ovan ska läsas som en nulägesbild, inte en garanti."
  );

  const projects = Array.isArray(future?.supportingData.nearbyPlannedProjects)
    ? (future?.supportingData.nearbyPlannedProjects as unknown[]).filter((p): p is string => typeof p === "string")
    : [];

  return { paragraphs: paragraphs.filter((p) => p && p.trim().length > 0), futureProjects: projects };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Final recommendation — "What should the buyer do next?"              */
/* ────────────────────────────────────────────────────────────────────── */

export interface FinalRecommendation {
  paragraphs: string[];
  strengths: string[];
  weaknesses: string[];
  actions: string[];
  questionsToAsk: string[];
  negotiationArguments: string[];
}

/** Composed straight from negotiation.ts's supportingData (days on market,
 *  price/income ratio, policy rate, population trend) — never the
 *  analyzer's English `explanation`. This is negotiation's one canonical
 *  home; no other chapter restates it. */
function negotiationSv(negotiation: ReportFactor | undefined): string {
  if (!negotiation) return "Förhandlingsläget kunde inte bedömas med tillräcklig säkerhet i denna analys.";
  const parts: string[] = [];

  const dom = num(negotiation.supportingData.daysOnMarket);
  if (dom !== null) {
    parts.push(
      dom < 7
        ? `bostaden lades ut för ${dom} dag${dom === 1 ? "" : "ar"} sedan, vilket generellt ger begränsat förhandlingsutrymme`
        : dom < 30
          ? `bostaden har varit till försäljning i ${dom} dagar, en tid som generellt förknippas med visst förhandlingsutrymme`
          : dom < 60
            ? `bostaden har varit till försäljning i ${dom} dagar, en längre tid som generellt förknippas med större förhandlingsutrymme`
            : `bostaden har varit till försäljning i ${dom} dagar — ovanligt länge, vilket historiskt sett ofta förknippas med större förhandlingsutrymme`
    );
  }

  const ratio = num(negotiation.supportingData.priceToIncomeRatio);
  if (ratio !== null) {
    parts.push(
      ratio > 6
        ? `priset motsvarar cirka ${ratio.toFixed(1)}x medianinkomsten i området, en nivå som generellt begränsar antalet köpare som har råd`
        : ratio < 4
          ? `priset motsvarar cirka ${ratio.toFixed(1)}x medianinkomsten i området, en nivå som generellt gör bostaden överkomlig för fler och kan öka konkurrensen om budgivningen`
          : `priset motsvarar cirka ${ratio.toFixed(1)}x medianinkomsten i området, en måttlig nivå i sammanhanget`
    );
  }

  const rate = num(negotiation.supportingData.currentPolicyRatePct);
  if (rate !== null) {
    parts.push(
      rate > 3.5
        ? `det höga ränteläget (${rate.toFixed(1)}%) förknippas generellt med färre konkurrerande budgivare`
        : rate < 1.5
          ? `det låga ränteläget (${rate.toFixed(1)}%) förknippas generellt med fler budgivare, vilket kan minska förhandlingsutrymmet`
          : `ränteläget (${rate.toFixed(1)}%) är för närvarande måttligt`
    );
  }

  const popGrowth = num(negotiation.supportingData.areaPopulationGrowthPct);
  if (popGrowth !== null) {
    parts.push(
      popGrowth > 1
        ? `befolkningsökningen i området (${pct(popGrowth)}) förknippas generellt med starkare efterfrågan och mindre förhandlingsutrymme`
        : popGrowth > 0
          ? `en stabil befolkningsutveckling (${popGrowth.toFixed(1)}%) förknippas generellt med måttlig efterfrågan`
          : `en minskande befolkning (${popGrowth.toFixed(1)}%) förknippas generellt med svagare efterfrågan och mer förhandlingsutrymme`
    );
  }

  if (parts.length === 0) return "Förhandlingsläget kunde inte bedömas med tillräcklig säkerhet i denna analys.";
  return `Vad gäller förhandlingsläget: ${listSv(parts)}.`;
}

/** Deliberately distinct phrasing from negotiationSv() above so the same
 *  fact isn't restated twice on one page — each bullet states a factor and
 *  what it's generally associated with, never an instruction to act on it. */
function negotiationArgumentsSv(negotiation: ReportFactor | undefined): string[] {
  if (!negotiation) return [];
  const args: string[] = [];
  const dom = num(negotiation.supportingData.daysOnMarket);
  if (dom !== null && dom >= 30) {
    args.push(`Bostaden har varit till försäljning i ${dom} dagar. En längre tid till försäljning förknippas generellt med större förhandlingsutrymme.`);
  }
  const ratio = num(negotiation.supportingData.priceToIncomeRatio);
  if (ratio !== null && ratio > 6) {
    args.push(`Priset motsvarar cirka ${ratio.toFixed(1)}x medianinkomsten i området, en nivå som generellt begränsar antalet köpare som har råd med bostaden.`);
  }
  const rate = num(negotiation.supportingData.currentPolicyRatePct);
  if (rate !== null && rate > 3.5) {
    args.push(`Det höga ränteläget (${rate.toFixed(1)}%) förknippas generellt med färre konkurrerande budgivare.`);
  }
  return args;
}

export function buildFinalRecommendation(report: AnalysisReport): FinalRecommendation {
  const scored = (report.decisionFactors ?? []).filter(
    (f): f is ReportFactor & { score: number } =>
      f.id !== "confidence" && f.id !== "negotiation" && f.score !== null
  );
  const strengths = scored
    .filter((f) => f.score >= 65)
    .map((f) => `${capitalize(svLabel(f.id))} — se kapitlet ${CHAPTER_FOR_FACTOR[f.id] ?? capitalize(svLabel(f.id))}.`);
  const weaknesses = scored
    .filter((f) => f.score < 45)
    .map((f) => `${capitalize(svLabel(f.id))} — se kapitlet ${CHAPTER_FOR_FACTOR[f.id] ?? capitalize(svLabel(f.id))}.`);

  const risk = factor(report, "risk");
  const negotiation = factor(report, "negotiation");
  const brf = factor(report, "housingAssociation");

  const paragraphs: string[] = [
    `Analysen baseras på ${report.dataCompleteness.connectedSources} av ${report.dataCompleteness.totalSources} anslutna datakällor.`,
    negotiationSv(negotiation),
    risk && risk.score !== null
      ? "En genomgång av åtta möjliga riskkategorier finns i kapitlet Möjliga risker."
      : "Riskbilden kunde inte sammanfattas fullt ut — se kapitlet Möjliga risker för detaljer om vad som saknas.",
  ];

  const actions: string[] = [
    "Bostadens skick, planlösning och eventuella brister utöver vad som anges i annonsen är inte verifierade i denna analys.",
    "Köparens egen lånekapacitet och lånelöfte ingår inte i denna analys.",
  ];
  if (!brf || brf.score === null) {
    actions.push("Föreningens årsredovisning och stadgar ingår inte i det underlag som kunnat verifieras i denna analys — se kapitlet Bostadsrättsförening för detaljer.");
  }

  const questionsToAsk = [
    "Uppgifter om planerat underhåll eller kommande avgiftshöjningar i föreningen ingår inte i denna analys.",
    "Uppgifter om fukt-, rör- eller elproblem i fastigheten eller lägenheten ingår inte i denna analys.",
    "Uppgifter om säljarens anledning till försäljning och boendetid ingår inte i denna analys.",
    "Uppgifter om antal budgivare vid tidigare visningar ingår inte i denna analys.",
  ];

  let negotiationArguments: string[] =
    negotiation && negotiation.score !== null && negotiation.score >= 50 ? negotiationArgumentsSv(negotiation) : [];
  if (risk && risk.score !== null && risk.score < 50) {
    negotiationArguments = [
      ...negotiationArguments,
      "Flera av observationerna i kapitlet Möjliga risker kan vara värda att lyfta i en förhandling.",
    ];
  }
  if (negotiationArguments.length === 0) {
    negotiationArguments = [
      "Ingen av de faktorer som ingår i denna analys (tid till försäljning, pris i förhållande till medianinkomst, ränteläge, befolkningsutveckling) avvek i denna körning på ett sätt som generellt förknippas med förhandlingsutrymme.",
    ];
  }

  return { paragraphs, strengths, weaknesses, actions, questionsToAsk, negotiationArguments };
}
