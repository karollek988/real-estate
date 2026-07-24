// Verification for the "make Köpanalys objective and evidence-based" sprint:
// audits every report chapter build.ts produces for recommendation language,
// subjective framing, unsourced comparisons, correct per-chapter source
// attribution, and graceful missing-data handling. No test framework in this
// project - see identityTrust.verify.mjs. Run with:
//   node --experimental-strip-types src/lib/report/build.objectivity.verify.mjs
import {
  buildExecutiveSummary,
  buildPropertyOverview,
  buildPriceAnalysis,
  buildAreaAnalysis,
  buildHousingAssociation,
  buildRiskCategories,
  buildInvestmentOutlook,
  buildFinalRecommendation,
  sourcesUsed,
} from "./build.ts";

let failures = 0;
function check(name, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}`);
  if (!pass) failures++;
}

/* ────────────────────────────────────────────────────────────────────── *
 *  Fixture 1: a rich, realistic analysis — every chapter has real data.  *
 * ────────────────────────────────────────────────────────────────────── */

const richDataSources = [
  { id: "nominatim_geocoding", name: "Geocoding (OpenStreetMap)", kind: "real", status: "ok", fields: ["municipality", "postalCode"] },
  { id: "hemnet_page_scrape", name: "Listing data (Hemnet)", kind: "real", status: "ok", fields: [] },
  { id: "booli_listing", name: "Listing & sold-price data (Booli)", kind: "real", status: "ok", fields: [] },
  { id: "scb_area_statistics", name: "Area statistics (SCB)", kind: "real", status: "ok", fields: [] },
  { id: "osm_amenities", name: "Amenities (OpenStreetMap)", kind: "real", status: "ok", fields: [] },
  { id: "interest_rates", name: "Policy rate (Riksbanken)", kind: "real", status: "ok", fields: [] },
  { id: "location_intelligence", name: "Location Intelligence", kind: "real", status: "ok", fields: [] },
  { id: "infrastructure_projects", name: "Infrastructure projects (Trafikverket)", kind: "real", status: "ok", fields: [] },
  { id: "market_intelligence", name: "Market Intelligence", kind: "real", status: "ok", fields: [] },
  { id: "brf_financials", name: "BRF financials", kind: "real", status: "ok", fields: [] },
  { id: "brf_acquisition", name: "BRF annual report acquisition", kind: "real", status: "ok", fields: [] },
  { id: "crime_statistics", name: "Crime statistics", kind: "placeholder", status: "not_connected", fields: [] },
  { id: "school_ratings", name: "School ratings", kind: "placeholder", status: "not_connected", fields: [] },
  { id: "environmental_data", name: "Environmental data", kind: "placeholder", status: "not_connected", fields: [] },
];

const richProperty = {
  address: "Sveavägen 45, Stockholm",
  postalCode: "11334",
  municipality: "Stockholm",
  floor: "4",
  apartmentNumber: "lgh 1204",
  propertyType: "Lägenhet",
  rooms: 3,
  buildingYear: 1965,
  renovationYear: 2005,
  housingAssociation: "Brf Sveaparken",
  housingAssociationConflict: null,
  askingPriceSek: 5_200_000,
  monthlyFeeSek: 4_500,
  operatingCostsSek: null,
  livingAreaM2: 68,
  additionalAreaM2: 5,
  lotAreaM2: null,
  pricePerM2Sek: 76_471,
  previousSalePriceSek: 4_100_000,
  previousSaleDate: "2016-06-01",
  mortgageDeed: true,
  solarPanels: false,
  fireplace: true,
  biddingOpen: true,
  newConstruction: false,
  energyClass: "D",
  description: "Ljus trea med balkong och öppen spis.",
  imageUrls: ["https://example.invalid/1.jpg"],
  floorplanUrls: [],
  features: ["Balkong", "Öppen spis"],
  condition: "Gott",
  balcony: true,
  elevator: true,
  parking: false,
  garage: false,
  storage: true,
  patio: false,
  broker: "Anna Andersson",
  agency: "Exempel Mäkleri",
  listingDate: new Date(Date.now() - 45 * 86_400_000).toISOString(),
  ownershipType: "Bostadsrätt",
  objectId: "9988776",
};

const richFactors = [
  {
    id: "price",
    label: "Price Level",
    score: 42,
    confidence: 0.85,
    status: "Above market",
    explanation: "Asking price is approximately 8% above the area's median price per m².",
    supportingData: {
      askingPriceSek: 5_200_000,
      pricePerM2Sek: 76_471,
      areaMedianPricePerM2Sek: 70_800,
      deltaVsAreaMedianPct: 8.0,
      comparableSales: [
        { address: "Sveavägen 41", soldPriceSek: 4_950_000, soldDate: "2026-05-02", livingAreaM2: 66, rooms: 3, pricePerM2Sek: 75_000 },
        { address: "Tegnérgatan 12", soldPriceSek: 4_700_000, soldDate: "2026-03-14", livingAreaM2: 64, rooms: 2, pricePerM2Sek: 73_437 },
      ],
      comparableSalesCount: 2,
      areaSoldPriceTrend: [
        { period: "2026-Q1", medianPricePerM2Sek: 69_500, count: 8 },
        { period: "2026-Q2", medianPricePerM2Sek: 70_800, count: 6 },
      ],
    },
    missingData: [],
    weight: 0.25,
  },
  {
    id: "area",
    label: "Area Development",
    score: 71,
    confidence: 0.7,
    status: "Positive",
    explanation: "Area price trend is positive.",
    supportingData: {
      areaPriceTrendPct: 4.2,
      areaPriceTrendPeriod: "senaste 12 månaderna",
      areaPopulationGrowthPct: 2.3,
    },
    missingData: [],
    weight: 0.15,
  },
  {
    id: "housingAssociation",
    label: "Housing Association",
    score: 58,
    confidence: 0.6,
    status: "Mixed finances",
    explanation: "Brf Sveaparken: financial analysis found 2 strengths and 1 weakness.",
    supportingData: {
      housingAssociation: "Brf Sveaparken",
      fiscalYear: 2025,
      equityRatio: 0.42,
      operatingMargin: 0.08,
      debtPerApartment: 285_000,
      feeSustainability: 96,
      liquidityMonths: 2.4,
      debtRatio: 0.58,
      debtToEquity: 1.38,
      totalDebt: 41_000_000,
      weightedAverageInterest: 2.1,
      shortTermDebtRatio: 0.12,
      costPerSqm: 480,
      numberOfRentalApartments: 3,
      numberOfCommercialUnits: 1,
      parkingSpaces: 12,
      garageSpaces: 4,
      findings: [
        { dimension: "financial_health", classification: "strength", severity: "minor", summary: "BRF har stark ekonomi med sunt egenkapital och positivt rörelseresultat." },
        { dimension: "debt_sustainability", classification: "strength", severity: "minor", summary: "BRF har hanterbar skuld med god räntetäckning." },
        { dimension: "liquidity", classification: "weakness", severity: "moderate", summary: "BRF:s likviditet är ansträngd." },
      ],
    },
    missingData: [],
    weight: 0.15,
  },
  {
    id: "risk",
    label: "Risk Assessment",
    score: 54,
    confidence: 0.65,
    status: "Moderate risk",
    explanation: "Combined risk factors.",
    supportingData: {
      policyRatePct: 2.75,
      buildingYear: 1965,
      buildingAgeYears: 61,
      renovationYear: 2005,
      areaPopulationGrowthPct: 2.3,
      amenityCounts: { grocery: 4, transit: 6 },
      highwayProximity: 0,
      riskFactors: [
        { factor: "population_trend", score: 72, weight: 0.2 },
        { factor: "interest_rate", score: 55, weight: 0.2 },
        { factor: "amenity_access", score: 80, weight: 0.15 },
        { factor: "noise_exposure", score: 85, weight: 0.15 },
        { factor: "building_age", score: 38, weight: 0.15 },
      ],
    },
    missingData: [],
    weight: 0.15,
  },
  {
    id: "market",
    label: "Market Conditions",
    score: 60,
    confidence: 0.6,
    status: "Stable",
    explanation: "Market indicators are moderate.",
    supportingData: {
      policyRateChangePctPoints: -0.5,
      currentPolicyRatePct: 2.75,
      municipalityEmploymentRatePct: 82.4,
    },
    missingData: [],
    weight: 0.1,
  },
  {
    id: "futureDevelopment",
    label: "Future Potential",
    score: 62,
    confidence: 0.5,
    status: "Some development nearby",
    explanation: "2 planned or active development projects found near this property.",
    supportingData: {
      nearbyPlannedProjectsCount: 2,
      nearbyPlannedProjects: ["Ny tunnelbanestation, Hagastaden", "Detaljplan för kontor, Vasastaden"],
    },
    missingData: [],
    weight: 0.1,
  },
  {
    id: "negotiation",
    label: "Negotiation Potential",
    score: 61,
    confidence: 0.7,
    status: "Moderate potential",
    explanation: "Negotiation signals.",
    supportingData: {
      daysOnMarket: 45,
      listingDate: richProperty.listingDate,
      priceToIncomeRatio: 6.8,
      currentPolicyRatePct: 2.75,
      areaPopulationGrowthPct: 2.3,
    },
    missingData: [],
    weight: 0.1,
  },
  {
    id: "confidence",
    label: "Confidence",
    score: 68,
    confidence: 1,
    status: "Good coverage",
    explanation: "Most sources connected.",
    supportingData: {},
    missingData: [],
    weight: 0,
  },
];

const richReport = {
  engineVersion: "test",
  generatedAt: new Date().toISOString(),
  factorsAnalyzed: richFactors.length,
  property: richProperty,
  decisionScore: 58,
  overallConfidence: 0.68,
  verdict: "Måttligt till högt beslutsbetyg",
  summary: "",
  insights: [],
  decisionFactors: richFactors,
  dataSources: richDataSources,
  dataCompleteness: { connectedSources: 11, totalSources: 14 },
};

/* ────────────────────────────────────────────────────────────────────── *
 *  Fixture 2: a near-empty analysis — nothing should be hidden/crash.    *
 * ────────────────────────────────────────────────────────────────────── */

const sparseProperty = {
  address: "Okänd väg 1, Okänd kommun",
  postalCode: null,
  municipality: null,
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
};

const sparseReport = {
  engineVersion: "test",
  generatedAt: new Date().toISOString(),
  factorsAnalyzed: 0,
  property: sparseProperty,
  decisionScore: 50,
  overallConfidence: 0.04,
  verdict: "Lågt beslutsbetyg",
  summary: "",
  insights: [],
  decisionFactors: [],
  dataSources: [],
  dataCompleteness: { connectedSources: 0, totalSources: 14 },
};

/* ────────────────────────────────────────────────────────────────────── *
 *  Assemble every chapter for both fixtures.                            *
 * ────────────────────────────────────────────────────────────────────── */

function assembleChapters(report, attributes = {}) {
  const exec = buildExecutiveSummary(report);
  const overview = buildPropertyOverview(report, attributes);
  const price = buildPriceAnalysis(report);
  const area = buildAreaAnalysis(report, attributes, report.dataSources);
  const brf = buildHousingAssociation(report, report.dataSources);
  const risks = buildRiskCategories(report, report.dataSources);
  const outlook = buildInvestmentOutlook(report);
  const rec = buildFinalRecommendation(report);

  return {
    exec,
    overview,
    price,
    area,
    brf,
    risks,
    outlook,
    rec,
    allChapterText: [
      ...exec,
      ...price.paragraphs,
      ...area.paragraphs,
      ...brf.paragraphs,
      ...brf.strengths,
      ...brf.weaknesses.map((w) => w.text),
      ...risks.flatMap((r) => [r.explanation, r.conclusion, ...r.evidence]),
      ...outlook.paragraphs,
      ...rec.paragraphs,
      ...rec.strengths,
      ...rec.weaknesses,
      ...rec.actions,
      ...rec.questionsToAsk,
      ...rec.negotiationArguments,
    ],
  };
}

const rich = assembleChapters(richReport, {
  median_income_sek_thousands: 480,
  area_population_growth_pct: 2.3,
  grocery_count_within_1000m: 4,
  school_count_within_1000m: 2,
  restaurant_count_within_1000m: 9,
  park_count_within_1000m: 3,
  transit_count_within_1000m: 6,
  hospital_count_within_1000m: 1,
});
const sparse = assembleChapters(sparseReport, {});

/* ────────────────────────────────────────────────────────────────────── *
 *  Automated checks: no recommendation / subjective / unsourced claims. *
 * ────────────────────────────────────────────────────────────────────── */

const BANNED_PATTERNS = [
  /rekommenderar/i,
  /rekommendation/i,
  /köpvärt/i,
  /vi bedömer/i,
  /vi rekommenderar/i,
  /boka en visning/i,
  /kontrollera ditt lånelöfte/i,
  /be mäklaren/i,
  /som argument/i,
  /överväg ett bud/i,
  /förefaller väl avvägt/i,
  /goda förutsättningar/i,
  /riksgenomsnittet/i,
  /\butmärkt\b/i,
  /\bperfekt\b/i,
  /\bbör (utredas|kontrolleras|bokas|begäras)\b/i,
];

for (const [fixtureName, chapters] of [["rich", rich], ["sparse", sparse]]) {
  for (const text of chapters.allChapterText) {
    if (typeof text !== "string") continue;
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(text)) {
        check(`[${fixtureName}] no banned pattern ${pattern} in: "${text.slice(0, 90)}..."`, false);
      }
    }
  }
}
check("banned-pattern scan completed (see any FAILs above)", true);

/* ────────────────────────────────────────────────────────────────────── *
 *  Sourcing checks.                                                     *
 * ────────────────────────────────────────────────────────────────────── */

check(
  "rich fixture: risk chapter's future-projects fact is backed by a listed source",
  sourcesUsed(richReport.dataSources, ["location_intelligence", "infrastructure_projects"]).length > 0
);
check(
  "rich fixture: property overview's geocoded fields are backed by a listed source",
  sourcesUsed(richReport.dataSources, ["hemnet_page_scrape", "booli_listing", "nominatim_geocoding"]).includes("OpenStreetMap")
);
check(
  "not_connected sources (crime_statistics) never appear as a cited source",
  !sourcesUsed(richReport.dataSources).includes("BRÅ/Polisen")
);
check(
  "sparse fixture: no sources cited when nothing is connected",
  sourcesUsed(sparseReport.dataSources).length === 0
);

/* ────────────────────────────────────────────────────────────────────── *
 *  Missing-data graceful handling (sparse fixture).                     *
 * ────────────────────────────────────────────────────────────────────── */

check("sparse: executive summary still produces paragraphs", sparse.exec.length > 0);
check("sparse: price chapter states no asking price rather than crashing", sparse.price.paragraphs.some((p) => p.includes("Inget utgångspris")));
check("sparse: area chapter states location could not be verified", sparse.area.paragraphs.some((p) => p.includes("inte kunnat verifieras")));
check("sparse: BRF chapter states no association identified", sparse.brf.paragraphs.some((p) => p.includes("Ingen bostadsrättsförening")));
check("sparse: BRF metrics fall back to an honest placeholder, not an empty grid", sparse.brf.metrics.length === 1 && sparse.brf.metrics[0].label === "Finansiella nyckeltal");
check("sparse: property overview never silently omits a field (spot check Balkong)", sparse.overview.some((r) => r.label === "Balkong" && r.value === "Uppgift saknas"));
check("sparse: all 8 risk categories still render with an 'unknown' severity", sparse.risks.length === 8 && sparse.risks.every((r) => r.severity === "unknown"));
check("sparse: final recommendation still states a decision score, not a purchase verdict", sparse.rec.paragraphs[0].includes("beslutsbetyget"));
check("sparse: negotiation fallback sentence appears when no factors are present", sparse.rec.negotiationArguments.some((n) => n.includes("Ingen av de faktorer")));

/* ────────────────────────────────────────────────────────────────────── *
 *  Rich-fixture spot checks: real content renders, chapter renamed.     *
 * ────────────────────────────────────────────────────────────────────── */

check("rich: price chapter cites the 8% delta vs area median", rich.price.paragraphs.some((p) => p.includes("8%") && p.includes("över")));
check("rich: price comparison object is populated for the visual meter", rich.price.comparison !== null);
check("rich: BRF debt education sentence appears when debt metrics are present", rich.brf.paragraphs.some((p) => p.includes("känslighet för framtida ränteförändringar")));
check("rich: BRF strengths/weaknesses pass through (Python reasoning.py text, out of TS scope)", rich.brf.strengths.length === 2 && rich.brf.weaknesses.length === 1);
check("rich: risk chapter reports population growth without asserting a single certain outcome", rich.risks.find((r) => r.id === "market").explanation.includes("förknippas generellt"));
check("rich: future-uncertainty risk category still names its epistemic-humility disclaimer", rich.risks.find((r) => r.id === "future").conclusion.includes("oförutsedda"));
check("rich: investment outlook mentions the 2 nearby projects factually", rich.outlook.paragraphs.some((p) => p.startsWith("2 planerat")));
check("rich: final recommendation opens with the decision score, not a buy/avoid verdict", rich.rec.paragraphs[0].includes("Det sammanvägda beslutsbetyget är 58 av 100"));
check("rich: negotiation arguments state factors, not instructions to use them", rich.rec.negotiationArguments.every((n) => !/använd|överväg/i.test(n)));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);

/* ────────────────────────────────────────────────────────────────────── *
 *  --dump: render the rich fixture as a full, human-readable report so   *
 *  it can actually be read chapter by chapter, not just pattern-checked. *
 * ────────────────────────────────────────────────────────────────────── */

if (process.argv.includes("--dump")) {
  const lines = [];
  const h1 = (t) => lines.push("", "=".repeat(70), t, "=".repeat(70));
  const h2 = (t) => lines.push("", "--- " + t + " ---");
  const src = (ids) => lines.push("[Källor: " + (sourcesUsed(richReport.dataSources, ids).join(", ") || "(inga)") + "]");

  h1(`KÖPANALYS — ${richReport.property.address}`);
  lines.push(`Sammanvägt betyg: ${richReport.verdict}  |  Beslutsbetyg: ${richReport.decisionScore}/100  |  Tillförlitlighet: ${Math.round(richReport.overallConfidence * 100)}%`);

  h1("2. SAMMANFATTNING");
  rich.exec.forEach((p) => lines.push(p, ""));
  src();

  h1("3. FASTIGHETSINFORMATION");
  rich.overview.forEach((r) => lines.push(`${r.label}: ${r.value}`));
  src(["hemnet_page_scrape", "booli_listing", "nominatim_geocoding"]);

  h1("4. PRISANALYS");
  rich.price.paragraphs.forEach((p) => lines.push(p, ""));
  src(["hemnet_page_scrape", "booli_listing", "scb_area_statistics", "interest_rates"]);

  h1("5. OMRÅDESANALYS");
  rich.area.paragraphs.forEach((p) => lines.push(p, ""));
  h2("Service inom 1 km");
  rich.area.amenities.forEach((a) => lines.push(`${a.label}: ${a.value}`));
  src(["booli_listing", "scb_area_statistics", "osm_amenities", "nominatim_geocoding"]);

  h1("6. BOSTADSRÄTTSFÖRENING");
  rich.brf.paragraphs.forEach((p) => lines.push(p, ""));
  h2("Nyckeltal");
  rich.brf.metrics.forEach((m) => lines.push(`${m.label}: ${m.value}`));
  h2("Styrkor");
  rich.brf.strengths.forEach((s) => lines.push("+ " + s));
  h2("Svagheter");
  rich.brf.weaknesses.forEach((w) => lines.push("- " + w.text + (w.severity ? ` (${w.severity})` : "")));
  src(["brf_financials", "brf_acquisition"]);

  h1("7. RISKBEDÖMNING");
  rich.risks.forEach((r) => {
    h2(`${r.label} — ${r.headline}`);
    lines.push(r.explanation);
    r.evidence.forEach((e) => lines.push("  * " + e));
    lines.push(r.conclusion);
  });
  src(["hemnet_page_scrape", "interest_rates", "scb_area_statistics", "osm_amenities", "brf_financials", "location_intelligence", "infrastructure_projects"]);

  h1("8. INVESTERINGSUTSIKT");
  rich.outlook.paragraphs.forEach((p) => lines.push(p, ""));
  h2("Planerad utveckling i närområdet");
  rich.outlook.futureProjects.forEach((p) => lines.push("* " + p));
  src(["interest_rates", "scb_area_statistics", "market_intelligence", "location_intelligence", "infrastructure_projects"]);

  h1("9. HELHETSBILD");
  rich.rec.paragraphs.forEach((p) => lines.push(p, ""));
  h2("Huvudsakliga styrkor");
  rich.rec.strengths.forEach((s) => lines.push("+ " + s));
  h2("Huvudsakliga svagheter");
  rich.rec.weaknesses.forEach((w) => lines.push("- " + w));
  h2("Avgränsningar i analysen");
  rich.rec.actions.forEach((a) => lines.push("* " + a));
  h2("Uppgifter som saknas för denna bostad");
  rich.rec.questionsToAsk.forEach((q) => lines.push("* " + q));
  h2("Faktorer kopplade till förhandlingsläget");
  rich.rec.negotiationArguments.forEach((n) => lines.push("* " + n));
  src(["hemnet_page_scrape", "booli_listing", "scb_area_statistics", "interest_rates"]);

  const fs = await import("node:fs");
  const outPath = process.argv[process.argv.indexOf("--dump") + 1] && !process.argv[process.argv.indexOf("--dump") + 1].startsWith("-")
    ? process.argv[process.argv.indexOf("--dump") + 1]
    : "sample-report.txt";
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`\nDumped full sample report to ${outPath}`);
}

process.exit(failures === 0 ? 0 : 1);
