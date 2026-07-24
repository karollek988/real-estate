// Standalone verification for identityTrust.ts (no test framework in this
// project - see End-to-End Truth Audit fix #2). Run with:
//   node --experimental-strip-types src/lib/analysis/identityTrust.verify.mjs
import { applyProtectedIdentityFields } from "./identityTrust.ts";

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

// 1. Lower-trust source may fill in an unset identity field.
check(
  "fills in housing_association when not yet known",
  applyProtectedIdentityFields({ housing_association: "Brf Solbacken" }, {}, "brf_acquisition"),
  { housing_association: "Brf Solbacken" }
);

// 2. Lower-trust source must NOT overwrite an already-known value, and the
// disagreement must be exposed rather than silently dropped.
check(
  "never overwrites an existing value, and records the disagreement",
  applyProtectedIdentityFields(
    { housing_association: "Brf Wrong Match" },
    { housing_association: "Brf Solbacken" },
    "brf_acquisition"
  ),
  {
    housing_association_conflict: {
      keptValue: "Brf Solbacken",
      rejectedValue: "Brf Wrong Match",
      rejectedSource: "brf_acquisition",
    },
  }
);

// 3. Agreement between sources produces no phantom conflict record.
check(
  "no conflict recorded when the new value agrees with the existing one",
  applyProtectedIdentityFields(
    { housing_association: "Brf Solbacken" },
    { housing_association: "Brf Solbacken" },
    "brf_acquisition"
  ),
  {}
);

// 4. Unrelated fields are untouched (not a protected identity field).
check(
  "unrelated fields pass through untouched",
  applyProtectedIdentityFields(
    { avg_monthly_fee: 4200 },
    { housing_association: "Brf Solbacken" },
    "brf_acquisition"
  ),
  { avg_monthly_fee: 4200 }
);

// 5. The trusted source (Hemnet's own page scrape — booli_listing no longer
// sets this field at all since its 2026-07-22 rewrite, so it can't be the
// trusted writer anymore) may always update the field, even correcting a
// stale value left by a prior run — it must never be blocked by its own
// past output or anyone else's.
check(
  "the trusted source can always overwrite, including a stale prior value",
  applyProtectedIdentityFields(
    { housing_association: "Brf Corrected Name" },
    { housing_association: "Brf Stale Old Value" },
    "hemnet_page_scrape"
  ),
  { housing_association: "Brf Corrected Name" }
);

// 6. Two lower-trust Booli-domain sources: parsebot_booli may fill a gap
// booli_listing (the trusted writer for this field) hasn't filled yet.
check(
  "parsebot_booli fills previous_sale_price_sek when unset",
  applyProtectedIdentityFields({ previous_sale_price_sek: 3800000 }, {}, "parsebot_booli"),
  { previous_sale_price_sek: 3800000 }
);

// 7. booli_listing is the trusted writer for Booli-domain fields — a
// conflicting value from parsebot_booli must be exposed, not silently kept
// or silently applied.
check(
  "booli_listing's existing value beats a conflicting parsebot_booli value, records conflict",
  applyProtectedIdentityFields({ fireplace: true }, { fireplace: false }, "parsebot_booli"),
  {
    fireplace_conflict: {
      keptValue: false,
      rejectedValue: true,
      rejectedSource: "parsebot_booli",
    },
  }
);

// 8. The trusted source can still always update a Booli-domain field, even
// against a value parsebot_booli filled in earlier.
check(
  "booli_listing can still freely overwrite once configured",
  applyProtectedIdentityFields({ previous_sale_price_sek: 3900000 }, { previous_sale_price_sek: 3800000 }, "booli_listing"),
  { previous_sale_price_sek: 3900000 }
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
