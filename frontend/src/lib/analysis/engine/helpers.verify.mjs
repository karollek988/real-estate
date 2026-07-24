// Standalone verification for engine/helpers.ts (no test framework in this
// project - see identityTrust.verify.mjs). Covers housingAssociationConflictOrNull,
// added for the Hemnet Pipeline Audit fix that carries
// attributes.housing_association_conflict through into AnalysisReport.property
// instead of silently dropping it (see buildAnalysis.ts).
// Run with:
//   node --experimental-strip-types src/lib/analysis/engine/helpers.verify.mjs
import { housingAssociationConflictOrNull, numberOrNull, stringOrNull } from "./helpers.ts";

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

check(
  "recognizes a well-formed conflict record",
  housingAssociationConflictOrNull({
    keptValue: "Brf Solbacken",
    rejectedValue: "Brf Wrong Match",
    rejectedSource: "brf_acquisition",
  }),
  { keptValue: "Brf Solbacken", rejectedValue: "Brf Wrong Match", rejectedSource: "brf_acquisition" }
);

check("returns null for undefined (no conflict stored)", housingAssociationConflictOrNull(undefined), null);
check("returns null for null", housingAssociationConflictOrNull(null), null);
check("returns null for a non-object value", housingAssociationConflictOrNull("Brf Solbacken"), null);
check(
  "returns null when a required key is missing",
  housingAssociationConflictOrNull({ keptValue: "Brf Solbacken", rejectedValue: "Brf Wrong Match" }),
  null
);
check(
  "returns null when a key has the wrong type",
  housingAssociationConflictOrNull({ keptValue: "Brf Solbacken", rejectedValue: "Brf Wrong Match", rejectedSource: 42 }),
  null
);

// Sanity check the two pre-existing helpers used alongside it in the same
// merge/fallback expressions (attributes.floor, attributes.lot_area_m2, ...).
check("numberOrNull passes through a finite number", numberOrNull(512), 512);
check("numberOrNull rejects a non-number", numberOrNull("512"), null);
check("stringOrNull passes through a non-empty string", stringOrNull("4 av 6"), "4 av 6");
check("stringOrNull rejects an empty/whitespace string", stringOrNull("   "), null);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
