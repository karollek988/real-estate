import type { AnalysisReport, DataSourceReport, DecisionFactorResult } from "@/lib/analysis/types";

/**
 * Turns the Decision Engine's structured output (scores, explanations,
 * supportingData, missingData — all already computed by
 * lib/analysis/engine/analyzers/*) into the prose and tables the document
 * report renders. This module never invents a fact: every sentence either
 * restates a real computed value or explains, from the analyzer's own
 * `missingData`/`supportingData`, why a value isn't available yet.
 *
 * Analyzer `explanation`/`status` strings are English (internal engine
 * output) and are never quoted verbatim here — every reader-facing sentence
 * is composed fresh in Swedish from `supportingData`, so the report never
 * leaks raw technical text. Each fact is also assigned to exactly one
 * "home" chapter; everywhere else a chapter needs to touch that same fact it
 * points back to the home chapter instead of restating it.
 */

const NA = "Uppgift saknas";

export function sek(value: number | null | undefined): string {
  if (value === null || value === undefined) return NA;
  return new Intl.NumberFormat("sv-SE").format(Math.round(value)) + " kr";
}

export function sekPerM2(value: number | null | undefined): string {
  if (value === null || value === undefined) return NA;
  return new Intl.NumberFormat("sv-SE").format(Math.round(value)) + " kr/m²";
}

export function pct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return NA;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/** Shared date formatting so the same fact (e.g. a previous sale date) never
 *  renders differently in different chapters. */
export function dateSv(value: string | null | undefined): string {
  if (!value) return NA;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" });
}

function factor(report: AnalysisReport, id: string): DecisionFactorResult | undefined {
  return report.decisionFactors?.find((f) => f.id === id);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function listSv(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} och ${items[items.length - 1]}`;
}

function svLabel(id: string): string {
  const map: Record<string, string> = {
    price: "prisnivån",
    area: "områdesutvecklingen",
    housingAssociation: "föreningens ekonomi",
    risk: "riskbilden",
    negotiation: "förhandlingsläget",
    futureDevelopment: "framtidspotentialen",
    market: "marknadsläget",
  };
  return map[id] ?? id;
}

/** Which chapter "owns" each analyzer's full explanation — used to build
 *  "see chapter X" pointers instead of repeating the same fact twice. */
const CHAPTER_FOR_FACTOR: Record<string, string> = {
  price: "Prisanalys",
  area: "Områdesanalys",
  housingAssociation: "Bostadsrättsförening",
  risk: "Riskbedömning",
  futureDevelopment: "Investeringsutsikt",
  market: "Investeringsutsikt",
};

function chaptersPointerSv(ids: string[]): string {
  const chapters = Array.from(new Set(ids.map((id) => CHAPTER_FOR_FACTOR[id]).filter((c): c is string => !!c)));
  if (chapters.length === 0) return "";
  return chapters.length === 1
    ? `Se kapitlet ${chapters[0]} för en fullständig genomgång.`
    : `Se kapitlen ${listSv(chapters)} för en fullständig genomgång.`;
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
  location_intelligence: "OpenStreetMap",
  market_intelligence: "Köpanalys marknadsanalys",
  brf_acquisition: "Bolagsverket",
  brf_financials: "Bolagsverket",
  lantmateriet_address: "Lantmäteriet",
  municipality_plans: "Kommunen",
  brf_register: "BRF-register",
  crime_statistics: "BRÅ/Polisen",
  school_ratings: "Skolverket",
  public_transport: "Trafiklab",
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
  crime_statistics: "ingen svensk brottsstatistik-API finns att koppla mot idag.",
  school_ratings: "OpenStreetMap visar bara skolors förekomst, inte Skolverkets betygsresultat.",
  municipality_plans: "kommunala detaljplaner saknar en enhetlig nationell källa att hämta ifrån idag.",
  environmental_data: "flödesrisk, buller och luftkvalitet kräver en separat geodatakälla som inte är kopplad ännu.",
  brf_register: "det kräver samma koppling mot organisationsnummer som föreningens ekonomi.",
  lantmateriet_address: "kräver en nyckelbaserad koppling mot Lantmäteriet som inte är på plats ännu.",
  public_transport: "OpenStreetMap visar bara hållplatsers förekomst, inte tidtabeller.",
};

function sourceExplainer(dataSources: DataSourceReport[], sourceId: string, prefix: string): string {
  const source = (dataSources ?? []).find((s) => s.id === sourceId);
  if (!source || source.status === "ok") return prefix;
  const detail = NOT_CONNECTED_SV[sourceId];
  const name = SHORT_SOURCE_NAMES[sourceId] ?? source.name;
  return detail ? `${prefix} ${capitalize(detail)}` : `${prefix} Källan (${name}) är inte ansluten i dagsläget.`;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Executive summary — 3-6 flowing paragraphs, no repeated chapter prose */
/* ────────────────────────────────────────────────────────────────────── */

export function buildExecutiveSummary(report: AnalysisReport): string[] {
  const paragraphs: string[] = [];
  const negotiation = factor(report, "negotiation");

  const priceLine = report.property.askingPriceSek
    ? `${report.property.address} är utannonserad för ${sek(report.property.askingPriceSek)}` +
      (report.property.livingAreaM2
        ? ` (${report.property.livingAreaM2} m², ${sekPerM2(report.property.pricePerM2Sek)}).`
        : ".")
    : `${report.property.address} analyseras utan ett registrerat utgångspris.`;

  paragraphs.push(
    `${priceLine} Det sammanvägda beslutsbetyget är ${report.decisionScore} av 100 (${report.verdict}), ` +
      `med en tillförlitlighet på ${Math.round(report.overallConfidence * 100)}% baserat på ` +
      `${report.dataCompleteness.connectedSources} av ${report.dataCompleteness.totalSources} anslutna datakällor.`
  );

  const scored = (report.decisionFactors ?? []).filter(
    (f): f is DecisionFactorResult & { score: number } =>
      f.id !== "confidence" && f.id !== "negotiation" && f.score !== null
  );
  const strengths = scored.filter((f) => f.score >= 65);
  const weaknesses = scored.filter((f) => f.score < 45);

  if (strengths.length > 0) {
    paragraphs.push(
      `Bostadens styrkor rör ${listSv(strengths.map((f) => svLabel(f.id)))}. ` +
        chaptersPointerSv(strengths.map((f) => f.id))
    );
  }

  if (weaknesses.length > 0) {
    paragraphs.push(
      `Bostadens svagheter rör ${listSv(weaknesses.map((f) => svLabel(f.id)))}. ` +
        chaptersPointerSv(weaknesses.map((f) => f.id))
    );
  }

  paragraphs.push(
    "Vad som kan påverka bostadens värde framöver — ränteläge, sysselsättning och planerad utveckling i " +
      "närområdet — beskrivs i kapitlet Investeringsutsikt."
  );

  if (negotiation) {
    paragraphs.push("Förhandlingsläget analyseras i kapitlet Helhetsbild.");
  }

  const unresolved = (report.decisionFactors ?? []).filter((f) => f.id !== "confidence" && f.score === null);
  paragraphs.push(
    `Analysens samlade tillförlitlighet är ${Math.round(report.overallConfidence * 100)}%. ` +
      (unresolved.length > 0
        ? `Följande områden kunde inte bedömas fullt ut i denna omgång: ${listSv(
            unresolved.map((f) => svLabel(f.id))
          )} — se respektive kapitel för en förklaring av vilka källor som saknas och varför.`
        : "Samtliga analysområden kunde bedömas utifrån de datakällor som är anslutna idag.")
  );

  return paragraphs.filter((p) => p && p.trim().length > 0);
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
    { label: "Mäklare", value: p.broker ?? str(attributes.broker) ?? NA },
    { label: "Mäklarbyrå", value: p.agency ?? str(attributes.agency) ?? NA },
    { label: "Annonsdatum", value: dateSv(p.listingDate ?? str(attributes.listing_date)) },
    { label: "Objekt-ID", value: p.objectId ?? NA },
    { label: "Planritning", value: (p.floorplanUrls ?? []).length > 0 ? "Ja" : NA },
    { label: "Bekvämligheter", value: (p.features ?? []).length > 0 ? (p.features ?? []).join(", ") : NA },
  ];
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Price analysis chapter — "Is the property reasonably priced?"        */
/* ────────────────────────────────────────────────────────────────────── */

export interface ComparableSaleRow {
  address: string | null;
  soldPriceSek: number | null;
  soldDate: string | null;
  livingAreaM2: number | null;
  rooms: number | null;
  pricePerM2Sek: number | null;
}

export interface AreaSoldPriceTrendPoint {
  period: string;
  medianPricePerM2Sek: number;
  count: number;
}

function parseComparableSales(value: unknown): ComparableSaleRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return {
      address: str(o.address),
      soldPriceSek: num(o.soldPriceSek),
      soldDate: str(o.soldDate),
      livingAreaM2: num(o.livingAreaM2),
      rooms: num(o.rooms),
      pricePerM2Sek: num(o.pricePerM2Sek),
    };
  });
}

function parseAreaSoldPriceTrend(value: unknown): AreaSoldPriceTrendPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      const o = (v ?? {}) as Record<string, unknown>;
      const period = str(o.period);
      const medianPricePerM2Sek = num(o.medianPricePerM2Sek);
      const count = num(o.count);
      return period !== null && medianPricePerM2Sek !== null && count !== null
        ? { period, medianPricePerM2Sek, count }
        : null;
    })
    .filter((v): v is AreaSoldPriceTrendPoint => v !== null);
}

/** Swedish affordability sentence for the no-comparables path — the only
 *  place this real cost-burden data (estimated monthly cost vs. income) is
 *  shown, since the analyzer's own English `explanation` is never quoted. */
function priceAffordabilitySv(price: DecisionFactorResult | undefined): string[] {
  if (!price) return [];
  const d = price.supportingData;
  const monthlyCost = num(d.estimatedMonthlyCost);
  const burdenPct = num(d.costBurdenPct);
  const pricePerM2 = num(d.pricePerM2Sek);
  const priceRange = str(d.priceRange);
  const sentences: string[] = [];

  if (monthlyCost !== null && burdenPct !== null) {
    const burdenNote =
      burdenPct < 30
        ? "en nivå som är överkomlig för de flesta köpare."
        : burdenPct < 40
          ? "en måttlig kostnadsbelastning, hanterbar för de flesta köpare."
          : burdenPct < 50
            ? "en betydande kostnadsbelastning som kan begränsa köparkretsen."
            : "en tung kostnadsbelastning som kraftigt begränsar antalet potentiella köpare.";
    sentences.push(
      `Den uppskattade månadskostnaden (ränta, amortering och avgift) är ${sek(monthlyCost)}, motsvarande ` +
        `${Math.round(burdenPct)}% av medianinkomsten i området — ${burdenNote}`
    );
  }
  if (pricePerM2 !== null) {
    sentences.push(
      `Priset per kvadratmeter är ${sekPerM2(pricePerM2)}. Ingen verifierad jämförelsedata för genomsnittligt pris per kvadratmeter i området eller riket är kopplad till denna analys, så nivån kan inte ställas mot ett bekräftat riktvärde här.`
    );
  }
  const rangeSv: Record<string, string> = {
    "entry-level": "en instegsbostad",
    "mid-range": "en bostad i mellansegmentet",
    "upper mid-range": "en bostad i övre mellansegmentet",
    premium: "en premiumbostad",
  };
  if (priceRange && rangeSv[priceRange]) {
    sentences.push(`Utgångspriset gör den till ${rangeSv[priceRange]}.`);
  }

  return sentences;
}

export interface PriceAnalysisContent {
  paragraphs: string[];
  comparison: { thisPricePerM2: number; areaMedianPerM2: number; deltaPct: number } | null;
  comparableSales: ComparableSaleRow[];
  areaSoldPriceTrend: AreaSoldPriceTrendPoint[];
  previousSale: { priceSek: number; date: string | null } | null;
}

export function buildPriceAnalysis(report: AnalysisReport): PriceAnalysisContent {
  const price = factor(report, "price");
  const paragraphs: string[] = [];
  const askingPrice = report.property.askingPriceSek;
  const pricePerM2 = report.property.pricePerM2Sek;
  const areaMedian = num(price?.supportingData.areaMedianPricePerM2Sek);
  const delta = num(price?.supportingData.deltaVsAreaMedianPct);
  const comparableSales = parseComparableSales(price?.supportingData.comparableSales);
  const areaSoldPriceTrend = parseAreaSoldPriceTrend(price?.supportingData.areaSoldPriceTrend);
  const previousSale =
    report.property.previousSalePriceSek !== null
      ? { priceSek: report.property.previousSalePriceSek, date: report.property.previousSaleDate }
      : null;

  paragraphs.push(
    askingPrice !== null
      ? `Utgångspriset för ${report.property.address} är ${sek(askingPrice)}` +
        (pricePerM2 ? `, motsvarande ${sekPerM2(pricePerM2)}.` : ".")
      : "Inget utgångspris är registrerat för denna bostad, vilket gör att en fullständig prisanalys inte kan genomföras — bedömningen nedan begränsas till den kontext som finns tillgänglig."
  );

  if (previousSale) {
    paragraphs.push(
      `Bostaden har tidigare sålts${previousSale.date ? ` (${dateSv(previousSale.date)})` : ""} för ${sek(previousSale.priceSek)}.`
    );
  }

  if (areaMedian !== null && delta !== null) {
    paragraphs.push(
      `Områdets medianpris ligger på ${sekPerM2(areaMedian)}. Det innebär att bostaden är prissatt ` +
        `${Math.abs(delta)}% ${delta < 0 ? "under" : "över"} områdets median per kvadratmeter.`
    );
  } else {
    paragraphs.push(
      "Ingen sammanställd områdesstatistik för medianpris per kvadratmeter är ännu kopplad till den här adressen, " +
        "så prisnivån kan i dagsläget inte jämföras direkt mot området."
    );
    const affordability = priceAffordabilitySv(price);
    if (affordability.length > 0) {
      paragraphs.push(...affordability);
    } else {
      paragraphs.push(
        "Den bedömning som ändå görs bygger istället på utgångspris, boarea och — där de finns — lokala inkomst- och räntedata."
      );
    }
  }

  paragraphs.push(
    comparableSales.length > 0
      ? `${comparableSales.length} jämförbara sålda bostäder i området har identifierats via Booli och ligger till grund ` +
        "för medianpriset ovan. Se tabellen nedan för de senaste försäljningarna."
      : "Jämförbara sålda bostäder ingår inte i denna analys: ingen källa för slutpriser (till exempel Mäklarstatistik, " +
        "eller sålda/avslutade annonser från Booli eller Hemnet) är ansluten i dagsläget. Historiska pristrender för " +
        "området kan därför inte redovisas här — det är den enskilt viktigaste datakällan som skulle stärka detta kapitel."
  );

  return {
    paragraphs,
    comparison:
      pricePerM2 !== null && areaMedian !== null && delta !== null
        ? { thisPricePerM2: pricePerM2, areaMedianPerM2: areaMedian, deltaPct: delta }
        : null,
    comparableSales,
    areaSoldPriceTrend,
    previousSale,
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Area analysis chapter — "Is this a good place to live?"              */
/* ────────────────────────────────────────────────────────────────────── */

export interface AmenityRow {
  label: string;
  value: string;
  note: string;
}

export interface AreaAnalysisContent {
  paragraphs: string[];
  amenities: AmenityRow[];
}

const AMENITY_FIELDS: Array<{ key: string; label: string; note: string }> = [
  { key: "grocery_count_within_1000m", label: "Matbutiker inom 1 km", note: "Antal registrerade i OpenStreetMap." },
  { key: "school_count_within_1000m", label: "Skolor inom 1 km", note: "Förekomst, ej kvalitetsbetyg — se förklaring nedan." },
  { key: "restaurant_count_within_1000m", label: "Restauranger & caféer inom 1 km", note: "Antal registrerade i OpenStreetMap." },
  { key: "park_count_within_1000m", label: "Parker & grönområden inom 1 km", note: "Antal registrerade i OpenStreetMap." },
  { key: "transit_count_within_1000m", label: "Kollektivtrafikhållplatser inom 1 km", note: "Förekomst, ej tidtabell — se förklaring nedan." },
  { key: "hospital_count_within_1000m", label: "Vårdinrättningar inom 1 km", note: "Antal registrerade i OpenStreetMap." },
];

/** One composed sentence for price trend + population + income — written
 *  once here so it can never also appear, restated, elsewhere in the report
 *  (Investeringsutsikt explicitly points back here instead of repeating). */
function areaContextSv(area: DecisionFactorResult | undefined, attributes: Record<string, unknown>): string {
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

  // Honest gaps: crime/safety and school quality are known-unconnected sources.
  paragraphs.push(
    sourceExplainer(
      dataSources,
      "crime_statistics",
      "Statistik om trygghet och brottslighet ingår inte i denna analys."
    ) +
      " " +
      sourceExplainer(
        dataSources,
        "school_ratings",
        "Skolornas kvalitet (betygsresultat) ingår inte i denna analys."
      )
  );

  return { paragraphs, amenities };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Housing association chapter — "Is the BRF financially healthy?"      */
/* ────────────────────────────────────────────────────────────────────── */

export interface BrfContent {
  paragraphs: string[];
  metrics: OverviewRow[];
  strengths: string[];
  weaknesses: { text: string; severity?: string }[];
}

const SEVERITY_SV: Record<string, string> = {
  minor: "mindre",
  moderate: "måttlig",
  significant: "betydande",
  critical: "kritisk",
};

/** Swedish summary of the BRF's financial picture — composed from
 *  supportingData/status only, never the analyzer's English `explanation`. */
function brfSummarySv(brf: DecisionFactorResult | undefined, brfName: string | null): string | null {
  if (brf && brf.score === null && brf.status === "Insufficient verified data") {
    // An annual report WAS found (even without a resolved name) but failed
    // validation — distinct enough from "nothing identified" to always state.
    return (
      (brfName ? `${brfName}: en` : "En") +
      " årsredovisning hittades för föreningen, men de extraherade siffrorna klarade inte vår kvalitetskontroll " +
      "(orimliga värden eller osäkra tolkningar) och har därför inte använts — vi visar hellre inga siffror än fel siffror."
    );
  }

  if (!brfName) {
    // The chapter's opening paragraph already states that no association
    // could be identified — nothing more to add without repeating it.
    return null;
  }

  if (!brf || brf.score === null) {
    return `Föreningen ${brfName} är identifierad, men dess ekonomi kunde inte bedömas — det kräver en verifierad årsredovisning från Bolagsverket, som inte är kopplad för denna förening idag.`;
  }

  const d = brf.supportingData;
  const findings = (d.findings as Array<{ classification: string }> | undefined) ?? [];
  const strengthsCount = findings.filter((f) => f.classification === "strength").length;
  const weaknessesCount = findings.filter((f) => f.classification === "weakness").length;
  const fiscalYear = d.fiscalYear ? String(d.fiscalYear) : null;

  return (
    `Den ekonomiska analysen av föreningens${fiscalYear ? ` årsredovisning för ${fiscalYear}` : " senaste årsredovisning"} ` +
    `visar ${strengthsCount} styrk${strengthsCount === 1 ? "a" : "or"} och ${weaknessesCount} svaghet${weaknessesCount === 1 ? "" : "er"}, ` +
    "inom bland annat soliditet, skuldsättning, avgiftsnivå och likviditet — se nyckeltalen nedan."
  );
}

export function buildHousingAssociation(report: AnalysisReport, dataSources: DataSourceReport[]): BrfContent {
  const brf = factor(report, "housingAssociation");
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

  const brfSummary = brfSummarySv(brf, brfName);
  if (brfSummary) paragraphs.push(brfSummary);

  if (brf && brf.score !== null) {
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
  } else if (brf) {
    paragraphs.push(
      sourceExplainer(
        dataSources,
        "brf_register",
        "Föreningens grunddata (antal lägenheter, byggår, förvaltning) kunde inte hämtas."
      )
    );
  }

  if (metrics.length === 0) {
    metrics.push({ label: "Finansiella nyckeltal", value: "Inga verifierade nyckeltal tillgängliga för denna förening ännu." });
  }

  return { paragraphs, metrics, strengths, weaknesses };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Risk assessment — "What are the biggest risks?" — 8 named categories */
/* ────────────────────────────────────────────────────────────────────── */

export type RiskSeverity = "low" | "medium" | "high" | "unknown";

export interface RiskCategory {
  id: string;
  label: string;
  severity: RiskSeverity;
  headline: string;
  explanation: string;
  evidence: string[];
  conclusion: string;
}

function severityFromScore(score: number | null): RiskSeverity {
  if (score === null) return "unknown";
  if (score >= 65) return "low";
  if (score >= 40) return "medium";
  return "high";
}

interface RawRiskFactor {
  factor: string;
  score: number;
  weight: number;
}

const DIMENSION_SV: Record<string, string> = {
  financial_health: "ekonomisk hälsa",
  debt_sustainability: "skuldsättning",
  fee_analysis: "avgiftsnivå",
  liquidity: "likviditet",
};

/** Each of these composes a fresh Swedish sentence straight from risk.ts's
 *  numeric supportingData (buildingYear, policyRatePct, ...) — never from
 *  risk.explanation, which concatenates all six signals into one English
 *  paragraph and previously got shown, whole, under four different headings. */
function riskBuildingAgeSv(risk: DecisionFactorResult | undefined): string {
  const buildingYear = num(risk?.supportingData.buildingYear);
  if (buildingYear === null) return "Byggår saknas för denna bostad, så underhållsrisken kan inte bedömas.";
  const age = num(risk?.supportingData.buildingAgeYears) ?? new Date().getFullYear() - buildingYear;
  const renovationYear = num(risk?.supportingData.renovationYear);
  return renovationYear !== null
    ? `Byggnaden uppfördes ${buildingYear} (${age} år gammal), med en senare större renovering ${renovationYear}.`
    : `Byggnaden uppfördes ${buildingYear} (${age} år gammal); inga större renoveringar är kända.`;
}

function riskInterestRateSv(risk: DecisionFactorResult | undefined): string {
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

function riskPopulationSv(risk: DecisionFactorResult | undefined): string {
  const pop = num(risk?.supportingData.areaPopulationGrowthPct);
  if (pop === null) return "Ingen befolkningsstatistik är kopplad till denna analys.";
  return (
    `Befolkningen i kommunen har ${pop >= 0 ? "ökat" : "minskat"} med ${Math.abs(pop).toFixed(1)}% de senaste fem åren. ` +
    "Befolkningstillväxt förknippas generellt med starkare efterfrågan på bostäder, medan en minskande befolkning generellt förknippas med svagare efterfrågan."
  );
}

function riskAmenitySv(risk: DecisionFactorResult | undefined): string {
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

function riskNoiseSv(risk: DecisionFactorResult | undefined): string {
  const highway = num(risk?.supportingData.highwayProximity);
  if (highway === null) return "Ingen data om vägbuller är kopplad till denna adress.";
  return (
    `${highway} större väg${highway === 1 ? "" : "ar"} registrerad${highway === 1 ? "" : "e"} inom 1 km. ` +
    "Närhet till större vägar förknippas generellt med högre bullerexponering och sämre luftkvalitet."
  );
}

function conclusionFromScore(score: number, topic: string): string {
  if (score >= 65) return `Tillgänglig data indikerar en låg risknivå kopplad till ${topic}.`;
  if (score >= 40) return `Tillgänglig data indikerar en måttlig risknivå kopplad till ${topic}.`;
  return `Tillgänglig data indikerar en förhöjd risknivå kopplad till ${topic}.`;
}

export function buildRiskCategories(report: AnalysisReport, dataSources: DataSourceReport[]): RiskCategory[] {
  const risk = factor(report, "risk");
  const brf = factor(report, "housingAssociation");
  const future = factor(report, "futureDevelopment");

  const riskFactors = (risk?.supportingData.riskFactors as RawRiskFactor[] | undefined) ?? [];
  const byFactor = new Map(riskFactors.map((r) => [r.factor, r]));

  const categories: RiskCategory[] = [];

  // 1. Market risk (population trend only — rate/employment live in Investeringsutsikt)
  {
    const pop = byFactor.get("population_trend");
    categories.push({
      id: "market",
      label: "Marknadsrisk",
      severity: severityFromScore(pop?.score ?? null),
      headline: "Efterfrågan på orten",
      explanation: pop
        ? `${riskPopulationSv(risk)} En bredare marknadsbild (ränteläge, sysselsättning) finns i kapitlet Investeringsutsikt.`
        : "Inga marknadsindikatorer är kopplade till denna analys ännu.",
      evidence: [],
      conclusion: pop ? conclusionFromScore(pop.score, "marknadsläget") : "Kan inte bedömas utan mer marknadsdata.",
    });
  }

  // 2. Interest rate risk
  {
    const ir = byFactor.get("interest_rate");
    categories.push({
      id: "interest_rate",
      label: "Ränterisk",
      severity: severityFromScore(ir?.score ?? null),
      headline: "Känslighet för förändrat ränteläge",
      explanation: ir ? riskInterestRateSv(risk) : "Ingen aktuell styrränta är kopplad till denna analys.",
      evidence: [],
      conclusion: ir ? conclusionFromScore(ir.score, "ränteläget") : "Kan inte bedömas utan ränteuppgifter.",
    });
  }

  // 3. Housing association risk
  {
    const findings = (brf?.supportingData.findings as Array<{ dimension: string; classification: string; severity?: string; summary: string }> | undefined) ?? [];
    const weaknesses = findings.filter((f) => f.classification === "weakness");
    const brfScore = brf?.score ?? null;
    categories.push({
      id: "housing_association",
      label: "Föreningsrisk",
      severity: severityFromScore(brfScore),
      headline: "Föreningens ekonomiska stabilitet",
      explanation:
        brfScore !== null
          ? `${weaknesses.length} svaghet${weaknesses.length === 1 ? "" : "er"} identifierad${weaknesses.length === 1 ? "" : "e"} i föreningens senaste årsredovisning. Se kapitlet Bostadsrättsförening för en fullständig genomgång.`
          : "Föreningens ekonomi kunde inte bedömas i denna analys.",
      evidence: [],
      conclusion: brfScore !== null ? conclusionFromScore(brfScore, "föreningens ekonomi") : "Kräver en verifierad årsredovisning för en säker bedömning.",
    });
  }

  // 4. Area risk
  {
    const amenity = byFactor.get("amenity_access");
    categories.push({
      id: "area",
      label: "Områdesrisk",
      severity: severityFromScore(amenity?.score ?? null),
      headline: "Service, tillgänglighet och läge",
      explanation: amenity ? riskAmenitySv(risk) : "Ingen data om närservice är kopplad till denna adress i denna analys.",
      evidence: [],
      conclusion: amenity ? conclusionFromScore(amenity.score, "närområdets service") : "Kan inte bedömas utan data om närservice.",
    });
  }

  // 5. Liquidity risk (BRF)
  {
    const liquidityMonths = num(brf?.supportingData.liquidityMonths);
    const score = liquidityMonths !== null ? (liquidityMonths >= 6 ? 75 : liquidityMonths >= 3 ? 55 : liquidityMonths >= 1 ? 35 : 15) : null;
    categories.push({
      id: "liquidity",
      label: "Likviditetsrisk",
      severity: severityFromScore(score),
      headline: "Föreningens kassalikviditet",
      explanation:
        liquidityMonths !== null
          ? `Föreningen har en uppskattad likviditetsbuffert motsvarande ${liquidityMonths} månaders löpande kostnader.`
          : "Föreningens likviditet (kassabuffert) kunde inte beräknas — detta kräver en verifierad årsredovisning, som inte är ansluten för denna förening idag.",
      evidence: [],
      conclusion: score !== null ? conclusionFromScore(score, "likviditeten") : "Kräver en verifierad årsredovisning.",
    });
  }

  // 6. Environmental risk
  {
    const noise = byFactor.get("noise_exposure");
    const envSource = (dataSources ?? []).find((s) => s.id === "environmental_data");
    categories.push({
      id: "environmental",
      label: "Miljörisk",
      severity: severityFromScore(noise?.score ?? null),
      headline: "Buller, luftkvalitet och översvämningsrisk",
      explanation:
        (noise ? riskNoiseSv(risk) : "Ingen data om vägbuller är kopplad till denna adress.") +
        (envSource && envSource.status !== "ok" ? ` ${capitalize(NOT_CONNECTED_SV.environmental_data)}` : ""),
      evidence: [],
      conclusion: noise ? conclusionFromScore(noise.score, "miljöexponeringen") : "Endast delvis kartlagt — se ovan.",
    });
  }

  // 7. Construction / building risk
  {
    const age = byFactor.get("building_age");
    categories.push({
      id: "construction",
      label: "Byggnadsrisk",
      severity: severityFromScore(age?.score ?? null),
      headline: "Byggnadens ålder och underhållsbehov",
      explanation: age ? riskBuildingAgeSv(risk) : "Byggår saknas för denna bostad, så underhållsrisk kan inte bedömas.",
      evidence: [],
      conclusion: age ? conclusionFromScore(age.score, "byggnadens skick") : "Kräver uppgift om byggår.",
    });
  }

  // 8. Future uncertainty
  {
    const count = num(future?.supportingData.nearbyPlannedProjectsCount);
    categories.push({
      id: "future",
      label: "Framtidsosäkerhet",
      severity: severityFromScore(future?.score ?? null),
      headline: "Osäkerhet i prognoser och planer",
      explanation:
        count !== null
          ? `${count} planerat eller pågående utvecklingsprojekt är känt i närområdet — dessa beskrivs i kapitlet Investeringsutsikt. Denna kategori bedömer istället den generella osäkerheten i framtidsprognoser.`
          : "Ingen data om planerad utveckling i området är kopplad till denna analys.",
      evidence: [],
      conclusion:
        "Alla framåtblickande bedömningar i denna rapport bygger på idag kända planer och trender — oförutsedda politiska, ekonomiska eller lokala beslut kan förändra bilden.",
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
function marketOutlookSv(market: DecisionFactorResult | undefined): string {
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

function futureProjectsOutlookSv(future: DecisionFactorResult | undefined): string {
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

const RISK_STATUS_SV: Record<string, string> = {
  "Low risk": "låg risk",
  "Moderate risk": "måttlig risk",
  "Elevated risk": "förhöjd risk",
  "High risk": "hög risk",
};

/** Composed straight from negotiation.ts's supportingData (days on market,
 *  price/income ratio, policy rate, population trend) — never the
 *  analyzer's English `explanation`. This is negotiation's one canonical
 *  home; no other chapter restates it. */
function negotiationSv(negotiation: DecisionFactorResult | undefined): string {
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
function negotiationArgumentsSv(negotiation: DecisionFactorResult | undefined): string[] {
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
    (f): f is DecisionFactorResult & { score: number } =>
      f.id !== "confidence" && f.id !== "negotiation" && f.score !== null
  );
  const strengths = scored
    .filter((f) => f.score >= 65)
    .map((f) => `${capitalize(svLabel(f.id))} (${f.score}/100) — se kapitlet ${CHAPTER_FOR_FACTOR[f.id] ?? capitalize(svLabel(f.id))}.`);
  const weaknesses = scored
    .filter((f) => f.score < 45)
    .map((f) => `${capitalize(svLabel(f.id))} (${f.score}/100) — se kapitlet ${CHAPTER_FOR_FACTOR[f.id] ?? capitalize(svLabel(f.id))}.`);

  const risk = factor(report, "risk");
  const negotiation = factor(report, "negotiation");
  const brf = factor(report, "housingAssociation");

  const paragraphs: string[] = [
    `Det sammanvägda beslutsbetyget är ${report.decisionScore} av 100 (${report.verdict}), med en tillförlitlighet på ` +
      `${Math.round(report.overallConfidence * 100)}% baserat på ${report.dataCompleteness.connectedSources} av ` +
      `${report.dataCompleteness.totalSources} anslutna datakällor.`,
    negotiationSv(negotiation),
    risk && risk.score !== null
      ? `Riskbilden klassificeras sammantaget som ${RISK_STATUS_SV[risk.status] ?? risk.status.toLowerCase()}. Se kapitlet Riskbedömning för en genomgång av samtliga åtta riskkategorier.`
      : "Riskbilden kunde inte sammanfattas fullt ut — se kapitlet Riskbedömning för detaljer om vad som saknas.",
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
      "En förhöjd riskbild, som beskrivs i kapitlet Riskbedömning, är en av de faktorer som generellt förknippas med förhandlingsutrymme.",
    ];
  }
  if (negotiationArguments.length === 0) {
    negotiationArguments = [
      "Ingen av de faktorer som ingår i denna analys (tid till försäljning, pris i förhållande till medianinkomst, ränteläge, befolkningsutveckling) avvek i denna körning på ett sätt som generellt förknippas med förhandlingsutrymme.",
    ];
  }

  return { paragraphs, strengths, weaknesses, actions, questionsToAsk, negotiationArguments };
}
