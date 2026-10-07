// Standalone verification for the report builders that decide WHAT a chapter
// shows: the property overview's facts, the BRF chapter's state machine
// (freehold / under review / overdue / published / update in progress / not
// applicable) and the questions chapter. Wording is audited separately in
// build.objectivity.verify.mjs. No test framework in this project (see the
// other *.verify.mjs). Run with:
//   npx tsx src/lib/report/build.verify.mjs
import { buildPropertyOverview as buildPropertyOverviewWith } from "./build.ts";
import { brfChapterState as brfChapterStateWith, brfStatusSentence as brfStatusSentenceWith, dueSv } from "./brfChapter.ts";
import { buildQuestions as buildQuestionsWith } from "./questions.ts";
import { swedishTextKit } from "../../i18n/textKit.ts";
import brfModule from "../../i18n/messages/sv/brf.ts";
import reportModule from "../../i18n/messages/sv/report.ts";
import { tenureOf, tenureOfProperty } from "./tenure.ts";
import { EMPTY_BRF_FIGURES } from "../brf/figures.ts";

// The report code writes its sentences through a text kit; these checks read the Swedish report, as before.
// (tsx wraps a default export twice when a .mjs file imports a .ts file.)
const brfSv = brfModule.default ?? brfModule;
const reportSv = reportModule.default ?? reportModule;
const KIT = swedishTextKit({ brf: brfSv, report: reportSv });
const buildPropertyOverview = (report, attributes) => buildPropertyOverviewWith(report, attributes, KIT);
const brfChapterState = (report, review, now) => brfChapterStateWith(report, review, KIT, now);
const brfStatusSentence = (state) => brfStatusSentenceWith(state, KIT);
const buildQuestions = (report, brf) => buildQuestionsWith(report, brf, KIT);

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

function property(overrides = {}) {
  return {
    address: "Testvägen 1, Stockholm", postalCode: "11122", municipality: "Stockholm", floor: "3", apartmentNumber: null,
    propertyType: "Lägenhet", rooms: 3, buildingYear: 1932, renovationYear: null, housingAssociation: "Brf Testet",
    housingAssociationConflict: null, askingPriceSek: 4_500_000, monthlyFeeSek: 4200, operatingCostsSek: null,
    livingAreaM2: 68, additionalAreaM2: 5, lotAreaM2: null, pricePerM2Sek: 66176, previousSalePriceSek: null,
    previousSaleDate: null, mortgageDeed: null, solarPanels: null, fireplace: null, biddingOpen: null,
    newConstruction: null, energyClass: null, description: null, imageUrls: [], floorplanUrls: [], features: [],
    condition: null, balcony: true, elevator: true, parking: null, garage: null, storage: null, patio: false,
    broker: null, agency: null, listingDate: null, ownershipType: "Bostadsrätt", objectId: "5551234",
    ...overrides,
  };
}
const report = (overrides) => ({
  engineVersion: "test", generatedAt: "", property: property(overrides), decisionFactors: [], dataSources: [],
  dataCompleteness: { connectedSources: 5, totalSources: 9 },
});

const NOW = new Date("2026-10-02T12:00:00Z");
const DUE = "2026-10-03T12:00:00Z";
const figures = { ...EMPTY_BRF_FIGURES, fiscalYear: 2024, debtPerSqmBr: 12000, interestSensitivityPct: 11, savingsPerSqm: 260 };
const review = (overrides) => ({ status: "pending", figures: null, publishedAt: null, dueAt: DUE, documentReceived: false, ...overrides });

// ── Property overview: the Booli-only facts and the previous sale render ─────
{
  const rows = buildPropertyOverview(
    report({ mortgageDeed: true, solarPanels: false, newConstruction: true, previousSalePriceSek: 3_100_000, previousSaleDate: "2019-05-02" }),
    {}
  );
  const value = (label) => rows.find((r) => r.label === label)?.value.replace(/\s/g, " ");
  check("overview: pantbrev", value("Pantbrev"), "Ja");
  check("overview: solceller", value("Solceller"), "Nej");
  check("overview: nyproduktion", value("Nyproduktion"), "Ja");
  check("overview: previous sale with date", value("Föregående försäljning"), "3 100 000 kr (2 maj 2019)");
  check("overview: a missing fact is stated, never hidden", value("Energiklass"), "Uppgift saknas");
}

// ── Tenure ───────────────────────────────────────────────────────────────────
check("tenure: bostadsrätt", tenureOf(property()), "cooperative");
check("tenure: villa", tenureOf(property({ propertyType: "Villa", ownershipType: "Äganderätt", monthlyFeeSek: null })), "freehold");
check("tenure: radhus with a fee is in an association", tenureOf(property({ propertyType: "Radhus", ownershipType: null, monthlyFeeSek: 3200 })), "cooperative");
check("tenure from a stored property (manual entry)", tenureOfProperty({ propertyType: "Villa", attributes: {} }), "freehold");
check("tenure: the manual form's Äganderätt option", tenureOf(property({ propertyType: "Äganderätt · 5 rum", ownershipType: null, monthlyFeeSek: null })), "freehold");
check("tenure: arrende (a house on leased land) has no association", tenureOfProperty({ propertyType: "Arrende", attributes: {} }), "freehold");
check("tenure: new-build bostadsrätt", tenureOfProperty({ propertyType: "Bostadsrätt (nyproduktion)", attributes: {} }), "cooperative");
check("tenure from Hemnet's own label", tenureOfProperty({ propertyType: null, attributes: { property_type_hemnet: "Lägenhet" } }), "cooperative");

// ── BRF chapter states ───────────────────────────────────────────────────────
{
  const s = brfChapterState(report({ propertyType: "Villa", ownershipType: "Äganderätt", monthlyFeeSek: null }), null, NOW);
  check("freehold: no BRF chapter", s.kind, "freehold");
  check("freehold: nothing about an association in the summary", brfStatusSentence(s), null);
}
{
  const s = brfChapterState(report(), review({}), NOW);
  check("pending: awaiting", s.kind, "awaiting");
  check("pending: not overdue before the deadline", s.overdue, false);
  check("pending: summary names the deadline in Swedish time", brfStatusSentence(s).includes("senast lördag 3 oktober kl. 14:00"), true);
}
{
  const s = brfChapterState(report(), review({ dueAt: "2026-10-01T08:00:00Z", documentReceived: true }), NOW);
  check("past the deadline: overdue, and says so", [s.kind, s.overdue, brfStatusSentence(s).includes("längre tid än utlovat")], ["awaiting", true, true]);
}
{
  const s = brfChapterState(report(), null, NOW);
  check("no review row (old report): awaiting without a promised time", [s.kind, s.dueAt], ["awaiting", null]);
  check("no review row: still promises 24 hours", brfStatusSentence(s).includes("inom 24 timmar"), true);
}
{
  const s = brfChapterState(report(), review({ status: "published", figures, publishedAt: "2026-10-02T09:00:00Z", dueAt: null }), NOW);
  check("published: reading built", s.kind, "published");
  check("published: no update in progress", s.update, null);
  check("published: the reading uses the home's own fee and size", s.reading.forYou.length > 0, true);
  check("published: summary counts the points worth a closer look (debt, rate sensitivity, no stated pipe replacement in a 1932 house)", brfStatusSentence(s).startsWith("BRF-analysen är granskad av Köpanalys (2 oktober 2026). 3 punkter är värda en närmare titt"), true);
}
{
  const s = brfChapterState(report(), review({ status: "pending", figures, publishedAt: "2026-09-01T09:00:00Z" }), NOW);
  check("new annual report after publication: the old analysis stays, update announced", [s.kind, s.update?.dueAt], ["published", DUE]);
}
{
  const s = brfChapterState(report(), review({ status: "not_applicable" }), NOW);
  check("not applicable", s.kind, "not_applicable");
}
check("dueSv: Swedish weekday, date and Stockholm time", dueSv("2026-12-24T16:30:00Z"), "torsdag 24 december kl. 17:30");
check("dueSv: nothing for a missing date", dueSv(null), null);

// ── Questions ────────────────────────────────────────────────────────────────
{
  const q = buildQuestions(report(), brfChapterState(report(), review({}), NOW));
  check("awaiting: generic association questions + a note that tailored ones follow", [q.association.length, q.associationNote !== null], [3, true]);
  check("bostadsrätt: who pays the transfer and pledge fees", q.broker.some((x) => x.includes("överlåtelseavgiften")), true);
  check("missing energy class becomes a question", q.broker.some((x) => x.includes("energideklaration")), true);
  check("the report says what it does not cover", q.notCovered.length >= 3, true);
}
{
  const published = brfChapterState(report(), review({ status: "published", figures, publishedAt: "2026-10-02T09:00:00Z", dueAt: null }), NOW);
  const q = buildQuestions(report(), published);
  check("published: the association questions come from the reviewed figures", q.association, published.reading.questions);
  check("published: no 'tailored questions follow' note", q.associationNote, null);
}
{
  const villa = report({ propertyType: "Villa", ownershipType: "Äganderätt", monthlyFeeSek: null });
  const q = buildQuestions(villa, brfChapterState(villa, null, NOW));
  check("house: no association questions", q.association, []);
  check("house: pantbrev and inspection questions", [q.broker.some((x) => x.includes("pantbrev")), q.broker.some((x) => x.includes("överlåtelsebesiktning"))], [true, true]);
}

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
