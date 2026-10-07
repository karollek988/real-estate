// Standalone verification for what a purchase is worth and how the account
// summary counts analyses: lib/stripe/prices.ts (credits per package, who may be
// charged for what), lib/analysis/ownership.ts's countAnalyses, and
// pipeline.ts's areaDataGathered (when an Områdesanalys counts as deliverable —
// otherwise the customer's credit is refunded). No test framework in this
// project. Run with:
//   npx tsx src/lib/analysis/credits.verify.mjs
import {
  getOneTimeProduct,
  getPriceId,
  getCouponId,
  isOneTimePriceKey,
} from "../stripe/prices.ts";
import { OMRADESANALYS_PRICE_SEK, TRYGGHETSPAKET_PRICE_SEK, TRE_BOSTADER_COUNT, TRE_BOSTADER_PRICE_SEK } from "../pricing.ts";
import { countAnalyses } from "./ownership.ts";
import { areaDataGathered } from "./pipeline.ts";

let failures = 0;
function check(name, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
  if (!condition) {
    failures++;
    if (detail !== undefined) console.log("  detail:", detail);
  }
}
function throws(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

// ── what is sold, and what each purchase credits ─────────────────────────────
check("prices are 99 / 499 / 999 kr", OMRADESANALYS_PRICE_SEK === 99 && TRYGGHETSPAKET_PRICE_SEK === 499 && TRE_BOSTADER_PRICE_SEK === 999);
check("Områdesanalys credits exactly one area analysis", JSON.stringify(getOneTimeProduct("omradesanalys").credits) === JSON.stringify({ full: 0, area: 1 }));
check("Trygghetspaket credits exactly one full analysis", JSON.stringify(getOneTimeProduct("trygghetspaket").credits) === JSON.stringify({ full: 1, area: 0 }));
check("Tre bostäder credits three full analyses", JSON.stringify(getOneTimeProduct("tre_bostader").credits) === JSON.stringify({ full: TRE_BOSTADER_COUNT, area: 0 }) && TRE_BOSTADER_COUNT === 3);

// The webhook credits whatever priceKey the session metadata carries, so the
// accepted keys must be exactly the three packages — nothing inherited from Object.
for (const key of ["omradesanalys", "trygghetspaket", "tre_bostader"]) {
  check(`"${key}" is an accepted price key`, isOneTimePriceKey(key));
}
for (const key of ["premium_analysis", "premium_monthly", "ultra_monthly", "constructor", "__proto__", "toString", "hasOwnProperty", "", undefined, null, 5, {}]) {
  check(`${JSON.stringify(key) ?? String(key)} is rejected as a price key`, !isOneTimePriceKey(key));
}

// ── Stripe ids come from the environment, and a missing one fails loudly ─────
delete process.env.STRIPE_PRICE_OMRADESANALYS;
check("a missing Price id throws (checkout fails instead of charging the wrong thing)", throws(() => getPriceId("omradesanalys")));
process.env.STRIPE_PRICE_OMRADESANALYS = "price_area_test";
check("a configured Price id is returned", getPriceId("omradesanalys") === "price_area_test");
delete process.env.STRIPE_COUPON_ANALYSIS_50OFF;
check("a missing coupon id throws", throws(() => getCouponId("trygghetspaket")));
process.env.STRIPE_COUPON_ANALYSIS_50OFF = "coupon_test";
check("one coupon serves both code kinds", getCouponId("trygghetspaket") === "coupon_test" && getCouponId("omradesanalys") === "coupon_test");

// ── account summary counts ───────────────────────────────────────────────────
const none = countAnalyses([]);
check("no analyses -> all zero", JSON.stringify(none) === JSON.stringify({ total: 0, brf: 0, area: 0, hiddenCosts: 0 }));
const mixed = countAnalyses([
  { analysisType: "full", status: "complete" },
  { analysisType: "full", status: "pending" },
  { analysisType: "area", status: "complete" },
  { analysisType: "area", status: "complete" },
  { analysisType: "full", status: "failed" },
  { analysisType: "area", status: "failed" },
]);
check(
  "a full analysis counts once as BRF, area and hidden costs; an area analysis only as area; failed ones not at all",
  JSON.stringify(mixed) === JSON.stringify({ total: 4, brf: 2, area: 4, hiddenCosts: 2 }),
  mixed
);

// ── when an area analysis is worth delivering ────────────────────────────────
const located = { latitude: 59.3, longitude: 18.0 };
const unlocated = { latitude: null, longitude: null };
const ok = (id) => ({ source: { id, name: id, kind: "real", status: "ok", fields: [] }, data: {} });
const noData = (id) => ({ source: { id, name: id, kind: "real", status: "no_data", fields: [] }, data: {} });
check("located + one area source with data -> deliverable", areaDataGathered(located, [ok("nominatim_geocoding"), ok("osm_amenities")]) === true);
check("not located -> not deliverable (refund)", areaDataGathered(unlocated, [ok("nominatim_geocoding"), ok("osm_amenities")]) === false);
check("located but every area source empty -> not deliverable (refund)", areaDataGathered(located, [ok("nominatim_geocoding"), noData("osm_amenities"), noData("scb_area_statistics")]) === false);
check("geocoding alone is not area content", areaDataGathered(located, [ok("nominatim_geocoding")]) === false);
check("a non-area source with data does not make an area report deliverable", areaDataGathered(located, [ok("hemnet_page_scrape")]) === false);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
