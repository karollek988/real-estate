// Standalone verification for providers/parseBotBooli.ts's field extraction
// (no test framework in this project — see identityTrust.verify.mjs). Run with:
//   node --experimental-strip-types src/lib/analysis/providers/parseBotBooli.verify.mjs
//
// Fixtures below mirror the REAL Parse.bot Booli.se API response shapes,
// confirmed live on 2026-07-22 against two real listings (not fabricated
// from docs alone) — see the header comment in parseBotBooli.ts for what
// was verified. Addresses/prices are fabricated; only the shape is real,
// including the literal `agency({"queryContext":...})` key name.
import {
  quantityNumber,
  extractHousingAssociationName,
  extractAgencyName,
  extractAmenityFlags,
  summarizePhotos,
} from "./parseBotBooli.ts";

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

// --- quantityNumber: Parse.bot's {raw,value,formatted,unit} quantity objects ---

check("quantityNumber reads the {raw} form", quantityNumber({ listPrice: { raw: 1295000, value: "1 295 000" } }, ["listPrice"]), 1295000);
check("quantityNumber reads a plain number", quantityNumber({ constructionYear: 1945 }, ["constructionYear"]), 1945);
check("quantityNumber falls back to parsing {value} when raw is missing", quantityNumber({ rent: { value: "2 463" } }, ["rent"]), 2463);
check("quantityNumber is undefined for a missing path", quantityNumber({}, ["rooms"]), undefined);

// --- extractHousingAssociationName: BRF name = last breadcrumb, gated on housingCoop.id ---

const DETAIL_WITH_BRF = {
  housingCoop: { id: "285560" },
  tenureForm: "Bostadsrätt",
  breadcrumbs: [
    { label: "Stockholms län", url: "/sok/till-salu?areaIds=2" },
    { label: "Sollentuna kommun", url: "/sok/till-salu?areaIds=13" },
    { label: "Sänkhagsvägen", url: "/sok/till-salu?areaIds=462872" },
    { label: "BRF Häggviks Dunge", url: "/bostadsrattsforening/285560" },
  ],
};
check("extracts BRF name from the last breadcrumb when its url matches housingCoop.id", extractHousingAssociationName(DETAIL_WITH_BRF), "BRF Häggviks Dunge");

check(
  "no BRF name for a villa (no housingCoop, last breadcrumb isn't a BRF url)",
  extractHousingAssociationName({
    housingCoop: undefined,
    breadcrumbs: [{ label: "Some Street", url: "/sok/till-salu?areaIds=1829" }],
  }),
  undefined
);

check(
  "mismatched housingCoop id vs breadcrumb url is rejected, not guessed",
  extractHousingAssociationName({
    housingCoop: { id: "999999" },
    breadcrumbs: [{ label: "BRF Wrong One", url: "/bostadsrattsforening/285560" }],
  }),
  undefined
);

// --- extractAgencyName: literal key includes a JSON-args suffix ---

check(
  "extracts agency name from the agency(...) keyed object",
  extractAgencyName({ 'agency({"queryContext":"PROPERTY_PAGE_LISTING"})': { name: "Bjurfors", thumbnail: "https://…" } }),
  "Bjurfors"
);
check("no agency name when the key is absent", extractAgencyName({}), undefined);

// --- extractAmenityFlags: presence-only list, absence must NEVER become false ---

check(
  "amenities present -> true flags only for recognized keys",
  extractAmenityFlags({ amenities: [{ key: "balcony", label: "Balkong" }, { key: "elevator", label: "Hiss" }] }),
  { balcony: true, elevator: true }
);
check("no amenities array -> empty object, not false flags", extractAmenityFlags({}), {});
check(
  "an amenity NOT listed is simply absent from the result (never asserted false)",
  Object.prototype.hasOwnProperty.call(extractAmenityFlags({ amenities: [{ key: "elevator", label: "Hiss" }] }), "balcony"),
  false
);

// --- summarizePhotos: count + floor-plan presence, no URL construction attempted ---

check(
  "counts photos and detects a floorplan-labeled entry",
  summarizePhotos([
    { id: "1", primaryLabel: "interior" },
    { id: "2", primaryLabel: "floorplan" },
    { id: "3", primaryLabel: "exterior" },
  ]),
  { count: 3, hasFloorplan: true }
);
check("no images -> zero count, no floorplan", summarizePhotos(undefined), { count: 0, hasFloorplan: false });

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
