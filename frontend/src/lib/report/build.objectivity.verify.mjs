// Audits every reader-facing sentence the report builders produce — the
// executive summary, area, the reviewed BRF analysis, risks, outlook and the
// questions chapter — for advice, rating or scoring language, and checks that
// missing data is stated rather than hidden. Köpanalys informs the buyer; it
// never tells them what to do and never scores the home.
// No test framework in this project (see the other *.verify.mjs). Run with:
//   npx tsx src/lib/report/build.objectivity.verify.mjs            (checks)
//   npx tsx src/lib/report/build.objectivity.verify.mjs --dump x.txt (also writes a readable sample report)
import {
  buildAreaAnalysis,
  buildExecutiveSummary,
  buildInvestmentOutlook,
  buildPropertyOverview,
  buildRiskCategories,
  sourcesUsed,
} from "./build.ts";
import { brfChapterState, brfIntroParagraphs } from "./brfChapter.ts";
import { buildQuestions } from "./questions.ts";
import { EMPTY_BRF_FIGURES } from "../brf/figures.ts";
import { BRF_BENCHMARK_SOURCES } from "../brf/interpret.ts";

let failures = 0;
function check(name, pass) {
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}`);
  if (!pass) failures++;
}

const NOW = new Date("2026-10-02T12:00:00Z");

const dataSources = [
  { id: "nominatim_geocoding", name: "Geocoding (OpenStreetMap)", kind: "real", status: "ok", fields: [] },
  { id: "booli_listing", name: "Booli", kind: "real", status: "ok", fields: [] },
  { id: "scb_area_statistics", name: "SCB", kind: "real", status: "ok", fields: [] },
  { id: "osm_amenities", name: "OpenStreetMap", kind: "real", status: "ok", fields: [] },
  { id: "interest_rates", name: "Riksbanken", kind: "real", status: "ok", fields: [] },
  { id: "location_intelligence", name: "Location Intelligence", kind: "real", status: "ok", fields: [] },
  { id: "infrastructure_projects", name: "Trafikverket", kind: "real", status: "ok", fields: [] },
  { id: "market_intelligence", name: "Market Intelligence", kind: "real", status: "ok", fields: [] },
  { id: "crime_statistics", name: "Crime statistics", kind: "placeholder", status: "not_connected", fields: [] },
  { id: "environmental_data", name: "Environmental data", kind: "placeholder", status: "not_connected", fields: [] },
];

const richProperty = {
  address: "Sveavägen 45, Stockholm", postalCode: "11334", municipality: "Stockholm", floor: "4", apartmentNumber: "lgh 1204",
  propertyType: "Lägenhet · 3 rum", rooms: 3, buildingYear: 1965, renovationYear: 2005, housingAssociation: "Brf Sveaparken",
  housingAssociationConflict: null, askingPriceSek: 5_200_000, monthlyFeeSek: 4_500, operatingCostsSek: null, livingAreaM2: 68,
  additionalAreaM2: 5, lotAreaM2: null, pricePerM2Sek: 76_471, previousSalePriceSek: 4_100_000, previousSaleDate: "2016-06-01",
  mortgageDeed: true, solarPanels: false, fireplace: true, biddingOpen: true, newConstruction: false, energyClass: "D",
  description: "Ljus trea med balkong och öppen spis.", imageUrls: [], floorplanUrls: [], features: ["Balkong", "Öppen spis"],
  condition: "Gott", balcony: true, elevator: true, parking: false, garage: false, storage: true, patio: false,
  broker: "Anna Andersson", agency: "Exempel Mäkleri", listingDate: "2026-08-20", ownershipType: "Bostadsrätt", objectId: "9988776",
};

const richFactors = [
  { id: "area", available: true, supportingData: { municipality: "Stockholm", areaPriceTrendPct: 1.9, areaPriceTrendPeriod: "2026Q1–2026Q2", areaPopulationGrowthPct: 2.3 } },
  { id: "market", available: true, supportingData: { policyRateChangePctPoints: -0.5, currentPolicyRatePct: 2.25, municipalityEmploymentRatePct: 80.1 } },
  { id: "risk", available: true, supportingData: { buildingYear: 1965, buildingAgeYears: 61, renovationYear: 2005, policyRatePct: 2.25, areaPopulationGrowthPct: 2.3, amenityCounts: { grocery: 4, transit: 6 }, highwayProximity: 1 } },
  { id: "futureDevelopment", available: true, supportingData: { nearbyPlannedProjectsCount: 2, nearbyPlannedProjects: ["Nya Tunnelbanan", "Kvarteret Hagastaden"] } },
  { id: "housingAssociation", available: true, supportingData: { housingAssociation: "Brf Sveaparken", reportState: "verified" } },
];

const report = (property, factors, sources) => ({
  engineVersion: "test", generatedAt: "", property, decisionFactors: factors, dataSources: sources,
  dataCompleteness: { connectedSources: sources.filter((s) => s.kind === "real").length, totalSources: sources.length },
});
const richReport = report(richProperty, richFactors, dataSources);
const richAttributes = {
  median_income_sek_thousands: 480, area_population_growth_pct: 2.3, grocery_count_within_1000m: 4, school_count_within_1000m: 2,
  restaurant_count_within_1000m: 9, park_count_within_1000m: 3, transit_count_within_1000m: 6, hospital_count_within_1000m: 1,
};

// A reviewed association with something to say on every figure.
const publishedFigures = {
  ...EMPTY_BRF_FIGURES,
  fiscalYear: 2025, annualFeePerSqm: 832, debtPerSqmBr: 11_400, debtPerSqmTotal: 10_900, savingsPerSqm: 124,
  interestSensitivityPct: 12.4, energyCostPerSqm: 283, feeShareOfRevenuePct: 88, equityRatioPct: 18,
  interestBearingDebtSek: 42_000_000, averageInterestRatePct: 3.1, debtRenegotiatedWithin12mPct: 55,
  numberOfApartments: 56, numberOfCommercialUnits: 2, isGenuine: true, landTenure: "leasehold", leaseholdRenegotiationYear: 2029,
  hasMaintenancePlan: true, pipesPlannedYear: 2028, plannedRenovations: "Fönsterbyte 2027 och takomläggning 2029 enligt underhållsplanen.",
  feeChangePct: 8, feeChangeEffective: "1 januari 2027",
  expertComment: "Föreningen har beslutat om stambyte 2028. Styrelsen räknar med att finansiera det med nya lån och den beslutade avgiftshöjningen.",
};

const states = {
  published: brfChapterState(richReport, { status: "published", figures: publishedFigures, publishedAt: "2026-10-02T09:00:00Z", dueAt: null, documentReceived: true }, NOW),
  awaiting: brfChapterState(richReport, { status: "pending", figures: null, publishedAt: null, dueAt: "2026-10-03T08:00:00Z", documentReceived: false }, NOW),
};

const sparseProperty = Object.fromEntries(Object.entries(richProperty).map(([k, v]) => [k, Array.isArray(v) ? [] : null]));
sparseProperty.address = "Okänd väg 1";
const sparseReport = report(sparseProperty, [], []);

function chapters(rep, attributes, brf) {
  const exec = buildExecutiveSummary(rep, brf);
  const overview = buildPropertyOverview(rep, attributes);
  const area = buildAreaAnalysis(rep, attributes, rep.dataSources);
  const risks = buildRiskCategories(rep, rep.dataSources, brf);
  const outlook = buildInvestmentOutlook(rep);
  const questions = buildQuestions(rep, brf);
  const reading = brf.kind === "published" ? brf.reading : null;
  const brfText = reading
    ? [
        ...[...reading.keyFigures, ...reading.loans, ...reading.association].flatMap((s) => [s.label, s.verdict, s.meaning, s.benchmark ?? ""]),
        ...reading.forYou.flatMap((i) => [i.label, i.explanation]),
        ...reading.strengths,
        ...reading.concerns,
      ]
    : [];
  return {
    exec, overview, area, risks, outlook, questions, reading,
    allText: [
      ...exec, ...brfIntroParagraphs(rep), ...area.paragraphs, ...brfText,
      ...risks.flatMap((r) => [r.explanation, r.conclusion, ...r.evidence]),
      ...outlook.paragraphs, ...questions.broker, ...questions.association, ...questions.notCovered,
      questions.associationNote ?? "",
    ],
  };
}

const rich = chapters(richReport, richAttributes, states.published);
const waiting = chapters(richReport, richAttributes, states.awaiting);
const sparse = chapters(sparseReport, {}, brfChapterState(sparseReport, null, NOW));

/* ── No advice, rating or scoring language anywhere ──────────────────── */

const BANNED_PATTERNS = [
  /rekommender/i,
  /köpvärt/i,
  /vi bedömer/i,
  /boka en visning/i,
  /be mäklaren/i,
  /som argument/i,
  /överväg ett bud/i,
  /\butmärkt\b/i,
  /\bperfekt\b/i,
  /\bbör (utredas|kontrolleras|bokas|begäras|köpa|buda)\b/i,
  /\bköp inte\b/i,
  /\bundvik\b/i,
  /förhandlingsutrymme/i,
  /\d+\s*\/\s*100\b/,
  /beslutsbetyg/i,
  /\bpoäng\b/i,
  /riskbilden klassificeras/i,
  /prisanalys/i,
];

for (const [name, ch] of [["rich", rich], ["awaiting", waiting], ["sparse", sparse]]) {
  for (const text of ch.allText) {
    if (typeof text !== "string") continue;
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(text)) check(`[${name}] banned pattern ${pattern} in: "${text.slice(0, 100)}..."`, false);
    }
  }
}
check("banned-pattern scan completed (see any FAILs above)", true);

/* ── Sources ─────────────────────────────────────────────────────────── */

check("not-connected sources are never cited", !sourcesUsed(dataSources).includes("Crime statistics"));
check("nothing is cited when nothing is connected", sourcesUsed(sparseReport.dataSources).length === 0);
check("the BRF benchmarks name where they come from", /SBAB/.test(BRF_BENCHMARK_SOURCES) && /Nabo/.test(BRF_BENCHMARK_SOURCES) && /BFNAR 2023:1/.test(BRF_BENCHMARK_SOURCES));

/* ── The BRF analysis is never shown before it is reviewed ────────────── */

check("awaiting: the summary says it is being reviewed, with the deadline", waiting.exec.some((p) => p.includes("granskas av Köpanalys experter") && p.includes("senast")));
check("awaiting: no BRF figures anywhere in the chapters", !waiting.allText.some((t) => /kr\/kvm/.test(t)));
check("awaiting: association risk says when it will be assessed", waiting.risks.find((r) => r.id === "housing_association").explanation.includes("granskas"));
check("published: the summary says the analysis was reviewed", rich.exec.some((p) => p.startsWith("BRF-analysen är granskad av Köpanalys")));
check("published: association risk lists the concerns as evidence", rich.risks.find((r) => r.id === "housing_association").evidence.length === rich.reading.concerns.length);
check("published: fee risk names what could raise the fee", rich.risks.find((r) => r.id === "fee").evidence.length >= 4);
check("published: the interest-rate category includes the association's sensitivity", rich.risks.find((r) => r.id === "interest_rate").explanation.includes("12,4"));

/* ── Missing data is stated, never hidden ─────────────────────────────── */

check("sparse: the summary still explains what the report covers", sparse.exec.length >= 4);
check("sparse: the area chapter says the location could not be verified", sparse.area.paragraphs.some((p) => p.includes("inte kunnat verifieras")));
check("sparse: the overview never drops a field", sparse.overview.some((r) => r.label === "Balkong" && r.value === "Uppgift saknas"));
check("sparse: a home of unknown tenure gets the association chapters (reviewer decides)", sparse.risks.some((r) => r.id === "housing_association"));
check("Boendekalkyl is described as coming soon, not as delivered", rich.exec.some((p) => p.includes("Boendekalkylen") && p.includes("lanseras inom kort")));
check("the outlook chapter is called Framtidsutsikter everywhere", !rich.allText.some((t) => /Investeringsutsikt/.test(t)));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);

/* ── --dump: the rich fixture as a readable report ───────────────────── */

if (process.argv.includes("--dump")) {
  const lines = [];
  const h1 = (t) => lines.push("", "=".repeat(70), t, "=".repeat(70));
  const h2 = (t) => lines.push("", "--- " + t + " ---");
  const flat = (s) => s.replace(/[  ]/g, " ");

  h1(`KÖPANALYS — ${richProperty.address}`);
  h1("SAMMANFATTNING");
  rich.exec.forEach((p) => lines.push(flat(p), ""));
  h1("BOENDEKALKYL");
  lines.push("[Lanseras inom kort — platshållare]");
  h1("BOSTADSRÄTTSFÖRENING");
  brfIntroParagraphs(richReport).forEach((p) => lines.push(p));
  h2("Det här ser bra ut");
  rich.reading.strengths.forEach((s) => lines.push("+ " + flat(s)));
  h2("Värt en närmare titt");
  rich.reading.concerns.forEach((s) => lines.push("! " + flat(s)));
  h2("Vad det betyder för dig");
  rich.reading.forYou.forEach((i) => lines.push(`${i.label}: ${flat(i.value)}`, "   " + flat(i.explanation)));
  for (const [title, list] of [["Nyckeltal", rich.reading.keyFigures], ["Föreningens lån", rich.reading.loans], ["Föreningen och underhållet", rich.reading.association]]) {
    h2(title);
    list.forEach((s) => lines.push(`${s.label}: ${flat(s.value)} — ${s.verdict} [${s.tone}]`, "   " + flat(s.meaning), ...(s.benchmark ? ["   " + flat(s.benchmark)] : [])));
  }
  if (rich.reading.missingKeyFigures.length) lines.push("", "Saknas: " + rich.reading.missingKeyFigures.join(", "));
  h2("Kommentar från granskaren");
  lines.push(rich.reading.expertComment ?? "");
  h1("OMRÅDESANALYS");
  rich.area.paragraphs.forEach((p) => lines.push(flat(p), ""));
  h1("MÖJLIGA RISKER");
  rich.risks.forEach((r) => {
    h2(`${r.label} — ${r.headline}`);
    lines.push(flat(r.explanation));
    r.evidence.forEach((e) => lines.push("  * " + flat(e)));
    lines.push(flat(r.conclusion));
  });
  h1("FRAMTIDSUTSIKTER");
  rich.outlook.paragraphs.forEach((p) => lines.push(flat(p), ""));
  h1("FRÅGOR INFÖR VISNINGEN");
  h2("Till mäklaren");
  rich.questions.broker.forEach((q) => lines.push("* " + q));
  h2("Till föreningen");
  rich.questions.association.forEach((q) => lines.push("* " + q));
  h2("Det här ingår inte i rapporten");
  rich.questions.notCovered.forEach((q) => lines.push("* " + q));

  const fs = await import("node:fs");
  const arg = process.argv[process.argv.indexOf("--dump") + 1];
  const outPath = arg && !arg.startsWith("-") ? arg : "sample-report.txt";
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(`\nDumped full sample report to ${outPath}`);
}

process.exit(failures === 0 ? 0 : 1);
