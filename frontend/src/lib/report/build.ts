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
 * Every reader-facing sentence is a message (src/i18n/messages/<language>/report.ts,
 * under "report"): this module decides WHICH sentence applies from the collected facts and
 * fills in the numbers, so the report never leaks raw technical text and every language
 * says the same things. Each fact is assigned to exactly one "home" chapter; everywhere
 * else a chapter needs to touch that same fact it points back to the home chapter instead
 * of restating it.
 */

import { capitalize, createFormat, num, str, type Format } from "./format";
import { tenureOf } from "./tenure";
import { brfStatusSentence, formatDue, type BrfChapterState } from "./brfChapter";
import type { TextKit } from "../../i18n/textKit";

export function factor(report: AnalysisReport, id: string): ReportFactor | undefined {
  return report.decisionFactors?.find((f) => f.id === id);
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Source attribution — short, honest names for the "Källor" section      */
/*  every chapter ends with. Only sources with status "ok" ever render —   */
/*  this list is never allowed to claim a source that wasn't actually      */
/*  connected for this analysis.                                           */
/* ────────────────────────────────────────────────────────────────────── */

/** The sources that have a short name in the messages (report.sources.names.<id>); any other source shows its own name. */
const SOURCES_WITH_SHORT_NAME = [
  "nominatim_geocoding",
  "hemnet_page_scrape",
  "booli_listing",
  "scb_area_statistics",
  "osm_amenities",
  "interest_rates",
  "smhi_climate",
  "infrastructure_projects",
  "location_intelligence",
  "market_intelligence",
  "brf_financials",
  "lantmateriet_address",
  "municipality_plans",
  "skolverket_schools",
  "environmental_data",
];

function shortName(source: { id: string; name: string }, kit: TextKit): string {
  return SOURCES_WITH_SHORT_NAME.includes(source.id) ? kit.t(`report.sources.names.${source.id}`) : source.name;
}

/** Friendly, deduped source names actually used ("ok") in a chapter. Pass no
 *  `ids` to list every connected source (used on the summary page). */
export function sourcesUsed(dataSources: DataSourceReport[], ids: string[] | undefined, kit: TextKit): string[] {
  const pool = ids
    ? ids.map((id) => (dataSources ?? []).find((s) => s.id === id)).filter((s): s is DataSourceReport => !!s)
    : dataSources ?? [];
  const names = pool.filter((s) => s.status === "ok").map((s) => shortName(s, kit));
  return Array.from(new Set(names));
}

/** The sources with an explanation of why they are not connected (report.sources.notConnected.<id>). */
const SOURCES_WITH_EXPLANATION = ["school_ratings", "municipality_plans", "environmental_data", "lantmateriet_address"];

function notConnectedExplanation(sourceId: string, kit: TextKit): string | null {
  return SOURCES_WITH_EXPLANATION.includes(sourceId) ? kit.t(`report.sources.notConnected.${sourceId}`) : null;
}

function sourceExplainer(dataSources: DataSourceReport[], sourceId: string, prefix: string, kit: TextKit): string {
  const source = (dataSources ?? []).find((s) => s.id === sourceId);
  if (!source || source.status === "ok") return prefix;
  const detail = notConnectedExplanation(sourceId, kit);
  return detail
    ? `${prefix} ${capitalize(detail)}`
    : `${prefix} ${kit.t("report.sources.notConnectedGeneric", { name: shortName(source, kit) })}`;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Executive summary — what the report contains and what is missing      */
/* ────────────────────────────────────────────────────────────────────── */

const UNRESOLVED_TOPICS = ["market", "risk", "futureDevelopment"] as const;

export function buildExecutiveSummary(report: AnalysisReport, brf: BrfChapterState, kit: TextKit): string[] {
  const t = kit.t;
  const fx = createFormat(kit);
  const p = report.property;
  const paragraphs: string[] = [];
  const hasAssociation = brf.kind !== "freehold" && brf.kind !== "not_applicable";

  const priceLine = p.askingPriceSek
    ? p.livingAreaM2
      ? t("report.summary.priceWithArea", {
          address: p.address,
          price: fx.sek(p.askingPriceSek),
          area: p.livingAreaM2,
          perM2: fx.sekPerM2(p.pricePerM2Sek),
        })
      : t("report.summary.priceOnly", { address: p.address, price: fx.sek(p.askingPriceSek) })
    : t("report.summary.noPrice", { address: p.address });
  paragraphs.push(
    t("report.summary.intro", {
      priceLine,
      scope: hasAssociation ? t("report.summary.scopeAssociation") : t("report.summary.scopeHome"),
      connected: report.dataCompleteness.connectedSources,
      total: report.dataCompleteness.totalSources,
    })
  );

  const brfSentence = brfStatusSentence(brf, kit);
  if (brfSentence) paragraphs.push(brfSentence);

  paragraphs.push(t("report.summary.housingCost"));
  paragraphs.push(t("report.summary.area"));
  paragraphs.push(t("report.summary.outlook"));

  const unresolved = UNRESOLVED_TOPICS.filter((id) => !factor(report, id)?.available);
  paragraphs.push(
    unresolved.length > 0
      ? t("report.summary.unresolved", { topics: fx.list(unresolved.map((id) => t(`report.summary.unresolvedTopics.${id}`))) })
      : t("report.summary.allResolved")
  );
  paragraphs.push(hasAssociation ? t("report.summary.questionsAssociation") : t("report.summary.questionsBroker"));

  return paragraphs.filter((x) => x && x.trim().length > 0);
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Property overview — every field, "Uppgift saknas" instead of hidden   */
/* ────────────────────────────────────────────────────────────────────── */

export interface OverviewRow {
  /** Names the row's label: report.overview.labels.<id> */
  id: string;
  label: string;
  value: string;
}

/** The kinds of home, tenure and condition come from the listings in Swedish; for a reader of another language the common ones are written in it. */
const TERM_IDS: Record<string, string> = {
  lägenhet: "lagenhet",
  bostadsrätt: "bostadsratt",
  "bostadsrätt (nyproduktion)": "bostadsrattNyproduktion",
  villa: "villa",
  radhus: "radhus",
  parhus: "parhus",
  kedjehus: "kedjehus",
  fritidshus: "fritidshus",
  tomt: "tomt",
  gård: "gard",
  äganderätt: "aganderatt",
  ägarlägenhet: "agarlagenhet",
  arrende: "arrende",
  utmärkt: "utmarkt",
  bra: "bra",
  okej: "okej",
  "behöver renovering": "renovering",
};

function term(value: string | null, kit: TextKit): string | null {
  // the listings are in Swedish: a Swedish reader gets the value exactly as it is
  if (value === null || kit.locale === "sv") return value;
  const id = TERM_IDS[value.trim().toLowerCase()];
  return id ? kit.t(`report.overview.terms.${id}`) : value;
}

export function buildPropertyOverview(report: AnalysisReport, attributes: Record<string, unknown>, kit: TextKit): OverviewRow[] {
  const t = kit.t;
  const fx = createFormat(kit);
  const p = report.property;
  const yesNo = (v: boolean | null) => (v === null ? fx.na : v ? t("report.format.yes") : t("report.format.no"));
  const row = (id: string, value: string): OverviewRow => ({ id, label: t(`report.overview.labels.${id}`), value });

  return [
    row("address", p.address || fx.na),
    row("municipality", p.municipality ?? str(attributes.municipality) ?? fx.na),
    row("postalCode", p.postalCode ?? fx.na),
    row("propertyType", term(p.propertyType, kit) ?? fx.na),
    row("housingAssociation", p.housingAssociation ?? str(attributes.housing_association) ?? fx.na),
    row("apartmentNumber", p.apartmentNumber ?? fx.na),
    row("floor", p.floor ?? fx.na),
    row("rooms", p.rooms !== null && p.rooms !== undefined ? String(p.rooms) : fx.na),
    row("livingArea", p.livingAreaM2 ? t("report.format.areaM2", { value: p.livingAreaM2 }) : fx.na),
    row("additionalArea", p.additionalAreaM2 ? t("report.format.areaM2", { value: p.additionalAreaM2 }) : fx.na),
    row("lotArea", p.lotAreaM2 ? t("report.format.areaM2", { value: p.lotAreaM2 }) : fx.na),
    row("askingPrice", fx.sek(p.askingPriceSek)),
    row("pricePerM2", fx.sekPerM2(p.pricePerM2Sek)),
    row("monthlyFee", fx.sek(p.monthlyFeeSek)),
    row("operatingCosts", p.operatingCostsSek ? t("report.format.perYear", { amount: fx.sek(p.operatingCostsSek) }) : fx.na),
    row("buildingYear", p.buildingYear ? String(p.buildingYear) : fx.na),
    row("renovationYear", p.renovationYear ? String(p.renovationYear) : fx.na),
    row("energyClass", p.energyClass ?? fx.na),
    row("condition", term(p.condition, kit) ?? fx.na),
    row("balcony", yesNo(p.balcony)),
    row("patio", yesNo(p.patio)),
    row("elevator", yesNo(p.elevator)),
    row("parking", yesNo(p.parking)),
    row("garage", yesNo(p.garage)),
    row("storage", yesNo(p.storage)),
    row("solarPanels", yesNo(p.solarPanels)),
    row("fireplace", yesNo(p.fireplace)),
    row("mortgageDeed", yesNo(p.mortgageDeed)),
    row("newConstruction", yesNo(p.newConstruction)),
    row("biddingOpen", yesNo(p.biddingOpen)),
    row(
      "previousSale",
      p.previousSalePriceSek
        ? p.previousSaleDate
          ? t("report.overview.previousSaleWithDate", { price: fx.sek(p.previousSalePriceSek), date: fx.date(p.previousSaleDate) })
          : fx.sek(p.previousSalePriceSek)
        : fx.na
    ),
    row("ownershipType", term(p.ownershipType ?? str(attributes.ownership_type), kit) ?? fx.na),
    row("listingDate", fx.date(p.listingDate ?? str(attributes.listing_date))),
    row("objectId", p.objectId ?? fx.na),
    row("floorplan", (p.floorplanUrls ?? []).length > 0 ? t("report.format.yes") : fx.na),
    row("features", (p.features ?? []).length > 0 ? (p.features ?? []).join(", ") : fx.na),
  ];
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Area analysis chapter — "Is this a good place to live?"              */
/* ────────────────────────────────────────────────────────────────────── */

export interface AmenityRow {
  /** Names the row's texts: report.area.amenities.<id>.label / .short / .note */
  id: string;
  label: string;
  short: string;
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

/** The service counts, in the order they are shown: which attribute holds each, and the id of its texts. */
const AMENITY_FIELDS = [
  { key: "grocery_count_within_1000m", id: "grocery" },
  { key: "school_count_within_1000m", id: "school" },
  { key: "restaurant_count_within_1000m", id: "restaurant" },
  { key: "park_count_within_1000m", id: "park" },
  { key: "transit_count_within_1000m", id: "transit" },
  { key: "hospital_count_within_1000m", id: "hospital" },
] as const;

/** One composed sentence for price trend + population + income — written
 *  once here so it can never also appear, restated, elsewhere in the report
 *  (Framtidsutsikter explicitly points back here instead of repeating). */
function areaContext(area: ReportFactor | undefined, attributes: Record<string, unknown>, kit: TextKit, fx: Format): string {
  const t = kit.t;
  const trendPct = num(area?.supportingData.areaPriceTrendPct);
  const trendPeriod = str(area?.supportingData.areaPriceTrendPeriod);
  const popPct = num(area?.supportingData.areaPopulationGrowthPct) ?? num(attributes.area_population_growth_pct);
  const income = num(attributes.median_income_sek_thousands);

  const parts: string[] = [];
  if (trendPct !== null) {
    parts.push(
      trendPeriod
        ? t("report.area.contextTrendPeriod", { trend: fx.pct(trendPct), period: trendPeriod })
        : t("report.area.contextTrend", { trend: fx.pct(trendPct) })
    );
  }
  if (popPct !== null) {
    parts.push(t("report.area.contextPopulation", { value: fx.pct(popPct) }));
  }
  if (income !== null) {
    parts.push(t("report.area.contextIncome", { value: Math.round(income) }));
  }

  if (parts.length === 0) return t("report.area.contextNone");
  return t("report.area.contextIntro", { list: fx.list(parts) });
}

export function buildAreaAnalysis(
  report: AnalysisReport,
  attributes: Record<string, unknown>,
  dataSources: DataSourceReport[],
  kit: TextKit
): AreaAnalysisContent {
  const t = kit.t;
  const fx = createFormat(kit);
  const area = factor(report, "area");
  const paragraphs: string[] = [];

  const municipality = report.property.municipality;
  paragraphs.push(
    municipality
      ? report.property.postalCode
        ? t("report.area.locatedWithPostalCode", { municipality, postalCode: report.property.postalCode })
        : t("report.area.located", { municipality })
      : t("report.area.notVerified")
  );

  paragraphs.push(areaContext(area, attributes, kit, fx));

  const amenities: AmenityRow[] = AMENITY_FIELDS.map(({ key, id }) => {
    const value = num(attributes[key]);
    return {
      id,
      label: t(`report.area.amenities.${id}.label`),
      short: t(`report.area.amenities.${id}.short`),
      value: value !== null ? String(value) : fx.na,
      note: t(`report.area.amenities.${id}.note`),
    };
  });
  const anyAmenityData = amenities.some((a) => a.value !== fx.na);
  if (anyAmenityData) {
    paragraphs.push(t("report.area.amenitiesIntro"));
  } else {
    paragraphs.push(sourceExplainer(dataSources, "osm_amenities", t("report.area.amenitiesNone"), kit));
  }

  const civicStats = buildCivicStats(attributes);
  paragraphs.push(civicStats ? t("report.area.civicWith") : t("report.area.civicNone"));

  const schools = buildNearbySchools(attributes, fx);
  if (schools) {
    paragraphs.push(t("report.area.schoolsNote"));
  }

  return { paragraphs, amenities, commute: buildCommuteInfo(attributes), schools, civicStats };
}

interface RawSchoolEntry {
  name?: unknown;
  address?: unknown;
  distanceM?: unknown;
  huvudman?: unknown;
  result?: { godkantAllaAmnenPct?: unknown; gymnasiebehorighetPct?: unknown; statisticsYear?: unknown } | null;
}

function toSchoolRow(entry: RawSchoolEntry, fx: Format): SchoolRow | null {
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
  return { name, address: str(entry.address), distanceLabel: fx.distance(distance), huvudman: str(entry.huvudman), result };
}

function schoolRows(value: unknown, fx: Format): SchoolRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (v && typeof v === "object" ? toSchoolRow(v as RawSchoolEntry, fx) : null))
    .filter((r): r is SchoolRow => r !== null);
}

/** Null when none of the three school sources (Skolverket + OSM) returned
 *  anything — lets the report skip the "Skolor i närområdet" sub-section
 *  cleanly rather than show an empty shell. */
function buildNearbySchools(attributes: Record<string, unknown>, fx: Format): NearbySchools | null {
  const preschools = schoolRows(attributes.nearby_preschools, fx);
  const primarySchools = schoolRows(attributes.nearby_primary_schools, fx);
  const highSchools = schoolRows(attributes.nearby_high_schools, fx);
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

/** Each of these composes a fresh sentence straight from risk.ts's
 *  supportingData (buildingYear, policyRatePct, ...). A category is only ever
 *  an observation about a collected fact — there is no severity or rating. */
function riskBuildingAge(risk: ReportFactor | undefined, kit: TextKit): string {
  const t = kit.t;
  const buildingYear = num(risk?.supportingData.buildingYear);
  if (buildingYear === null) return t("report.risks.buildingAgeMissing");
  const age = num(risk?.supportingData.buildingAgeYears) ?? new Date().getFullYear() - buildingYear;
  const renovationYear = num(risk?.supportingData.renovationYear);
  return renovationYear !== null
    ? t("report.risks.buildingAgeRenovated", { year: buildingYear, age, renovation: renovationYear })
    : t("report.risks.buildingAgeNoRenovation", { year: buildingYear, age });
}

function riskInterestRate(risk: ReportFactor | undefined, kit: TextKit, fx: Format): string {
  const t = kit.t;
  const rate = num(risk?.supportingData.policyRatePct);
  if (rate === null) return t("report.risks.rateMissing");
  const note = rate > 3 ? t("report.risks.rateHigh") : rate < 1.5 ? t("report.risks.rateLow") : t("report.risks.rateMedium");
  return t("report.risks.rateSentence", { rate: fx.ratePct(rate), note });
}

function riskPopulation(risk: ReportFactor | undefined, kit: TextKit, fx: Format): string {
  const t = kit.t;
  const pop = num(risk?.supportingData.areaPopulationGrowthPct);
  if (pop === null) return t("report.risks.populationMissing");
  return t("report.risks.populationSentence", { direction: pop >= 0 ? "up" : "down", value: fx.dec(Math.abs(pop)) });
}

function riskAmenity(risk: ReportFactor | undefined, kit: TextKit, fx: Format): string {
  const t = kit.t;
  const counts = risk?.supportingData.amenityCounts as { grocery?: number; transit?: number } | undefined;
  if (!counts) return t("report.risks.amenityMissing");
  const grocery = counts.grocery ?? 0;
  const transit = counts.transit ?? 0;
  const notes: string[] = [];
  if (grocery <= 1) notes.push(t("report.risks.amenityFewGrocery", { count: grocery }));
  if (transit <= 2) notes.push(t("report.risks.amenityFewTransit", { count: transit }));
  return notes.length > 0
    ? t("report.risks.amenityLimited", { list: fx.list(notes) })
    : t("report.risks.amenityEnough", { grocery, transit });
}

function riskNoise(risk: ReportFactor | undefined, kit: TextKit): string {
  const t = kit.t;
  const highway = num(risk?.supportingData.highwayProximity);
  if (highway === null) return t("report.risks.noiseMissing");
  return t("report.risks.noiseSentence", { count: highway });
}

export function buildRiskCategories(
  report: AnalysisReport,
  dataSources: DataSourceReport[],
  brf: BrfChapterState,
  kit: TextKit
): RiskCategory[] {
  const t = kit.t;
  const fx = createFormat(kit);
  const risk = factor(report, "risk");
  const future = factor(report, "futureDevelopment");
  const hasAssociation = brf.kind === "awaiting" || brf.kind === "published";
  const reading = brf.kind === "published" ? brf.reading : null;
  const signal = (id: string) =>
    reading ? [...reading.keyFigures, ...reading.loans, ...reading.association].find((s) => s.id === id) ?? null : null;
  const awaitingLine =
    brf.kind === "awaiting"
      ? (() => {
          const due = formatDue(brf.dueAt, kit);
          return due && !brf.overdue ? t("report.risks.association.awaitingDue", { when: due }) : t("report.risks.association.awaiting");
        })()
      : null;
  const riskData = risk?.supportingData ?? {};
  const label = (id: string) => t(`report.risks.categories.${id}.label`) as string;
  const headline = (id: string) => t(`report.risks.categories.${id}.headline`) as string;

  const categories: RiskCategory[] = [];

  // 1. Market risk (population trend only — rate/employment live in Framtidsutsikter)
  {
    const hasPopulation = num(riskData.areaPopulationGrowthPct) !== null;
    categories.push({
      id: "market",
      label: label("market"),
      headline: headline("market"),
      explanation: hasPopulation
        ? t("report.risks.market.population", { populationSentence: riskPopulation(risk, kit, fx) })
        : t("report.risks.market.none"),
      evidence: [],
      conclusion: hasPopulation ? t("report.risks.market.conclusion") : t("report.risks.market.conclusionNone"),
    });
  }

  // 2. Interest rate risk — the policy rate, and the association's sensitivity once the BRF analysis is published
  {
    const hasRate = num(riskData.policyRatePct) !== null;
    const sensitivity = signal("interestSensitivity");
    categories.push({
      id: "interest_rate",
      label: label("interest_rate"),
      headline: headline("interest_rate"),
      explanation: (hasRate ? riskInterestRate(risk, kit, fx) : t("report.risks.rateMissing")) + (sensitivity ? ` ${sensitivity.meaning}` : ""),
      evidence: [],
      conclusion: hasRate || sensitivity ? t("report.risks.interest.conclusion") : t("report.risks.interest.conclusionNone"),
    });
  }

  // 3. Housing association risk (only for homes that have an association)
  if (hasAssociation) {
    const concerns = reading?.concerns ?? [];
    categories.push({
      id: "housing_association",
      label: label("housing_association"),
      headline: headline("housing_association"),
      explanation: reading
        ? concerns.length > 0
          ? t("report.risks.association.concerns", { count: concerns.length })
          : t("report.risks.association.none")
        : awaitingLine!,
      evidence: concerns,
      conclusion: reading ? t("report.risks.association.conclusion") : t("report.risks.association.conclusionWaiting"),
    });
  }

  // 4. Area risk
  {
    const hasAmenities = risk?.supportingData.amenityCounts !== undefined;
    categories.push({
      id: "area",
      label: label("area"),
      headline: headline("area"),
      explanation: hasAmenities ? riskAmenity(risk, kit, fx) : t("report.risks.amenityMissing"),
      evidence: [],
      conclusion: hasAmenities ? t("report.risks.areaRisk.conclusion") : t("report.risks.areaRisk.conclusionNone"),
    });
  }

  // 5. Fee risk — what could raise the monthly fee (BRF)
  if (hasAssociation) {
    const drivers = reading
      ? [
          signal("feeChange")?.tone === "watch" ? signal("feeChange") : null,
          signal("pipes")?.tone === "watch" ? signal("pipes") : null,
          signal("plannedRenovations"),
          signal("land")?.code === "leasehold" ? signal("land") : null,
          signal("savings")?.tone === "watch" || signal("savings")?.tone === "alert" ? signal("savings") : null,
          signal("interestSensitivity")?.tone === "watch" || signal("interestSensitivity")?.tone === "alert"
            ? signal("interestSensitivity")
            : null,
        ].filter((s): s is NonNullable<typeof s> => s !== null)
      : [];
    categories.push({
      id: "fee",
      label: label("fee"),
      headline: headline("fee"),
      explanation: reading ? (drivers.length > 0 ? t("report.risks.fee.drivers") : t("report.risks.fee.none")) : awaitingLine!,
      evidence: drivers.map((d) => d.summary),
      conclusion: reading ? t("report.risks.fee.conclusion") : t("report.risks.fee.conclusionWaiting"),
    });
  }

  // 6. Environmental risk
  {
    const hasNoise = num(riskData.highwayProximity) !== null;
    const envSource = (dataSources ?? []).find((s) => s.id === "environmental_data");
    categories.push({
      id: "environmental",
      label: label("environmental"),
      headline: headline("environmental"),
      explanation:
        (hasNoise ? riskNoise(risk, kit) : t("report.risks.noiseMissing")) +
        (envSource && envSource.status !== "ok" ? ` ${capitalize(notConnectedExplanation("environmental_data", kit) ?? "")}` : ""),
      evidence: [],
      conclusion: hasNoise ? t("report.risks.environmental.conclusion") : t("report.risks.environmental.conclusionNone"),
    });
  }

  // 7. Construction / building risk — building age, and the pipes once the BRF analysis is published
  {
    const hasAge = num(riskData.buildingYear) !== null;
    const pipes = signal("pipes");
    categories.push({
      id: "construction",
      label: label("construction"),
      headline: headline("construction"),
      explanation: (hasAge ? riskBuildingAge(risk, kit) : t("report.risks.construction.ageMissing")) + (pipes ? ` ${pipes.summary}.` : ""),
      evidence: [],
      conclusion: hasAge ? t("report.risks.construction.conclusion") : t("report.risks.construction.conclusionNone"),
    });
  }

  // 8. Future uncertainty
  {
    const count = num(future?.supportingData.nearbyPlannedProjectsCount);
    categories.push({
      id: "future",
      label: label("future"),
      headline: headline("future"),
      explanation:
        count !== null
          ? t("report.risks.future.explanation", {
              known: count === 1 ? t("report.risks.future.one") : t("report.risks.future.many", { count }),
            })
          : t("report.risks.future.none"),
      evidence: [],
      conclusion: t("report.risks.future.conclusion"),
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
 *  facts (areaContext) and are deliberately not restated here. */
function marketOutlook(market: ReportFactor | undefined, kit: TextKit, fx: Format): string {
  const t = kit.t;
  const rateChange = num(market?.supportingData.policyRateChangePctPoints);
  const currentRate = num(market?.supportingData.currentPolicyRatePct);
  const employment = num(market?.supportingData.municipalityEmploymentRatePct);
  const parts: string[] = [];

  if (rateChange !== null) {
    parts.push(
      rateChange < -0.25
        ? t("report.outlook.rateLowered", { value: fx.dec(Math.abs(rateChange), 2) })
        : rateChange > 0.25
          ? t("report.outlook.rateRaised", { value: fx.dec(rateChange, 2) })
          : currentRate !== null
            ? t("report.outlook.rateStableWith", { rate: fx.ratePct(currentRate) })
            : t("report.outlook.rateStable")
    );
  }
  if (employment !== null) {
    parts.push(t("report.outlook.employment", { value: fx.dec(employment) }));
  }

  if (parts.length === 0) return t("report.outlook.marketNone");
  return parts.join(" ");
}

function futureProjectsOutlook(future: ReportFactor | undefined, kit: TextKit): string {
  const t = kit.t;
  const count = num(future?.supportingData.nearbyPlannedProjectsCount);
  if (count === null) return t("report.outlook.projectsMissing");
  if (count === 0) return t("report.outlook.projectsZero");
  return t("report.outlook.projectsFound", { found: count === 1 ? t("report.outlook.projectsOne") : t("report.outlook.projectsMany", { count }) });
}

export function buildInvestmentOutlook(report: AnalysisReport, kit: TextKit): InvestmentOutlookContent {
  const t = kit.t;
  const fx = createFormat(kit);
  const future = factor(report, "futureDevelopment");
  const market = factor(report, "market");
  const paragraphs: string[] = [];

  paragraphs.push(t("report.outlook.intro"));
  paragraphs.push(marketOutlook(market, kit, fx));
  paragraphs.push(futureProjectsOutlook(future, kit));
  paragraphs.push(t("report.outlook.uncertainty"));

  // OpenStreetMap construction sites without a name come through as
  // "unnamed construction site" — a placeholder, not something to list.
  const projects = Array.isArray(future?.supportingData.nearbyPlannedProjects)
    ? (future?.supportingData.nearbyPlannedProjects as unknown[]).filter(
        (p): p is string => typeof p === "string" && p.trim() !== "" && !/^unnamed\b/i.test(p.trim())
      )
    : [];

  return { paragraphs: paragraphs.filter((p) => p && p.trim().length > 0), futureProjects: projects };
}
