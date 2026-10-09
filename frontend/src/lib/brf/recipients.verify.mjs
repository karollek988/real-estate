// Standalone verification for who is e-mailed when a reviewer publishes (lib/brf/recipients.ts).
// No test framework in this project (see the other *.verify.mjs). Run with:
//   npx tsx src/lib/brf/recipients.verify.mjs
import { reviewMailRecipients } from "./recipients.ts";

let failures = 0;
function check(name, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
  if (!condition) {
    failures++;
    if (detail !== undefined) console.log("  detail:", detail);
  }
}

const set = (...ids) => new Set(ids);
const run = (requests, releasedIds, stillWaitingIds, brfPublished) =>
  Object.fromEntries(reviewMailRecipients(requests, { releasedIds: set(...releasedIds), stillWaitingIds: set(...stillWaitingIds), brfPublished }));

// first release of a report: the buyer hears "your report is ready"
check(
  "a customer whose report was just released gets the report e-mail",
  JSON.stringify(run([{ userId: "u1", analysisId: "a1" }], ["a1"], [], true)) === JSON.stringify({ u1: "report" })
);
check(
  "...also when the reviewer marked the home as having no association (no BRF publish)",
  JSON.stringify(run([{ userId: "u1", analysisId: "a1" }], ["a1"], [], false)) === JSON.stringify({ u1: "report" })
);

// a later round: the report was released long ago, the BRF figures are updated
check(
  "a customer who already had a released report gets the BRF e-mail when figures are published",
  JSON.stringify(run([{ userId: "u1", analysisId: "a0" }], [], [], true)) === JSON.stringify({ u1: "brf" })
);
check(
  "...and nothing when only 'no association' was marked and nothing was released",
  Object.keys(run([{ userId: "u1", analysisId: "a0" }], [], [], false)).length === 0
);

// a report that still waits (another version, or not finished) is not announced
check(
  "a customer whose report still waits gets nothing yet",
  Object.keys(run([{ userId: "u1", analysisId: "a2" }], [], ["a2"], true)).length === 0
);
check(
  "a waiting report is never announced even if the same analysis id were listed as released",
  Object.keys(run([{ userId: "u1", analysisId: "a2" }], ["a2"], ["a2"], true)).length === 0
);

// mixed owners of one property
const mixed = run(
  [
    { userId: "u1", analysisId: "a1" }, // released now
    { userId: "u2", analysisId: "a0" }, // released earlier
    { userId: "u3", analysisId: "a2" }, // still waiting
  ],
  ["a1"],
  ["a2"],
  true
);
check("three owners of one property each get the right mail", JSON.stringify(mixed) === JSON.stringify({ u1: "report", u2: "brf" }), mixed);

// one customer, two requests: the report e-mail wins whatever the order
const a = run([{ userId: "u1", analysisId: "a0" }, { userId: "u1", analysisId: "a1" }], ["a1"], [], true);
const b = run([{ userId: "u1", analysisId: "a1" }, { userId: "u1", analysisId: "a0" }], ["a1"], [], true);
check("a customer with a released and an older report gets one e-mail, the report one", a.u1 === "report" && b.u1 === "report" && Object.keys(a).length === 1 && Object.keys(b).length === 1, { a, b });

check("nobody to tell means nobody is told", Object.keys(run([], ["a1"], [], true)).length === 0);

process.exit(failures === 0 ? 0 : 1);
