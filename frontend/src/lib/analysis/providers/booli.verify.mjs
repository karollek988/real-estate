// Standalone verification for providers/booli.ts's extraction pipeline
// (no test framework in this project — see identityTrust.verify.mjs). Run with:
//   node --experimental-strip-types src/lib/analysis/providers/booli.verify.mjs
//
// The fixtures below mirror the *real* Property JSON schema used by Booli
// API v2's /listings and /sold (confirmed 2026-07-22 via three independent
// open-source clients — rbooli, the `booli-api` npm package, and
// peterstark72/booli — that agree on field names/types; see the header
// comment in booli.ts for how that was cross-checked against the live
// endpoint without an API key). All addresses/prices below are fabricated;
// only the shape is real, including Booli's own "mortageDeed" key typo.
import { addressesMatch, parseBooliProperty, summarizeSoldListings } from "./booli.ts";

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

// --- addressesMatch: the identity guard that keeps Booli's free-text search
// from merging the wrong unit into a Hemnet-identified property. ---

check("exact match", addressesMatch("Dalagatan 30", "Dalagatan 30"), true);
check(
  "candidate has trailing floor/apartment suffix — still matches",
  addressesMatch("Dalagatan 30", "Dalagatan 30, 4tr"),
  true
);
check("different street number — rejected", addressesMatch("Dalagatan 30", "Dalagatan 32"), false);
check("different street entirely — rejected", addressesMatch("Hantverkargatan 30", "Sveavägen 44"), false);
check("no candidate address — rejected", addressesMatch("Dalagatan 30", null), false);

// --- parseBooliProperty: field-by-field mapping against the confirmed schema ---

const FIXTURE_LISTING = {
  booliId: 5551234,
  url: "https://www.booli.se/annons/5551234",
  objectType: "Lägenhet",
  location: {
    address: { streetAddress: "Testvägen 1" },
    region: { municipalityName: "Stockholms kommun", countyName: "Stockholm" },
    position: { latitude: 59.34, longitude: 18.06 },
  },
  listPrice: 4500000,
  firstPrice: 4750000,
  rent: 4200,
  livingArea: 68,
  plotArea: 0,
  additionalArea: 5,
  rooms: 3,
  floor: 3,
  constructionYear: 1932,
  published: "2026-06-01 10:00:00",
  hasBalcony: 1,
  hasPatio: 0,
  buildingHasElevator: 1,
  isNewConstruction: 0,
  hasSolarPanels: 1,
  hasFirePlace: 0,
  biddingOpen: 1,
  mortageDeed: 0,
};

check("parseBooliProperty maps the confirmed Property schema", parseBooliProperty(FIXTURE_LISTING), {
  booliId: 5551234,
  url: "https://www.booli.se/annons/5551234",
  objectType: "Lägenhet",
  streetAddress: "Testvägen 1",
  municipalityName: "Stockholms kommun",
  countyName: "Stockholm",
  latitude: 59.34,
  longitude: 18.06,
  listPriceSek: 4500000,
  firstPriceSek: 4750000,
  publishedDate: "2026-06-01 10:00:00",
  rooms: 3,
  livingAreaM2: 68,
  plotAreaM2: 0,
  additionalAreaM2: 5,
  monthlyFeeSek: 4200,
  floor: 3,
  buildingYear: 1932,
  balcony: true,
  patio: false,
  elevator: true,
  newConstruction: false,
  solarPanels: true,
  fireplace: false,
  biddingOpen: true,
  mortgageDeed: false,
});

// --- summarizeSoldListings: splitting a /sold result set into the subject's
// own sale history vs. area comparables, and deriving the area median
// price/m2 that engine/analyzers/price.ts has been waiting on. ---

const SOLD_RESULTS = [
  // The subject property's own previous sale — must be excluded from comps.
  {
    location: { address: { streetAddress: "Testvägen 1" } },
    soldPrice: 3800000,
    soldDate: "2021-03-10",
    livingArea: 68,
  },
  {
    location: { address: { streetAddress: "Testvägen 3" } },
    soldPrice: 4200000,
    soldDate: "2026-04-15",
    livingArea: 70,
    rooms: 3,
  },
  {
    location: { address: { streetAddress: "Testvägen 5" } },
    soldPrice: 4000000,
    soldDate: "2026-01-20",
    livingArea: 65,
    rooms: 2,
  },
  {
    location: { address: { streetAddress: "Testvägen 7" } },
    soldPrice: 3900000,
    soldDate: "2025-11-05",
    livingArea: 60,
    rooms: 2,
  },
];

const summary = summarizeSoldListings(SOLD_RESULTS, "Testvägen 1");

check("previous sale of the exact address is extracted, not treated as a comp", summary.previousSalePriceSek, 3800000);
check("previous sale date carried through", summary.previousSaleDate, "2021-03-10");
check("comparables exclude the subject's own history", summary.comparableSalesCount, 3);
check(
  "area median price/m2 computed from comparables only (60000, 61538->61538? see below)",
  summary.areaMedianPricePerM2Sek,
  // pricePerM2: Testvägen 3 = round(4200000/70)=60000, Testvägen 5 = round(4000000/65)=61538,
  // Testvägen 7 = round(3900000/60)=65000 -> median of [60000,61538,65000] = 61538
  61538
);
check("quarterly trend groups comparables chronologically", summary.areaSoldPriceTrend, [
  { period: "2025-Q4", medianPricePerM2Sek: 65000, count: 1 },
  { period: "2026-Q1", medianPricePerM2Sek: 61538, count: 1 },
  { period: "2026-Q2", medianPricePerM2Sek: 60000, count: 1 },
]);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
