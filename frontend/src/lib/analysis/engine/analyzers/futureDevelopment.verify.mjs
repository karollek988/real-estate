// Standalone verification for futureDevelopment.ts (no test framework in this
// project - see helpers.verify.mjs). "Not checked" must stay distinct from
// "checked, none found".
// Run with:
//   npx tsx src/lib/analysis/engine/analyzers/futureDevelopment.verify.mjs
import { futureDevelopmentAnalyzer } from "./futureDevelopment.ts";

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

const run = (attributes) =>
  futureDevelopmentAnalyzer.analyze({ property: {}, extracted: { attributes: {} }, attributes, dataSources: [] });

{
  const r = run({});
  check("never checked - not available", r.available, false);
  check("never checked - nothing invented", r.supportingData, {});
}

{
  const r = run({ nearby_planned_projects: [] });
  check("checked, none found - available", r.available, true);
  check("checked, none found - count 0", r.supportingData, { nearbyPlannedProjectsCount: 0 });
}

{
  const projects = Array.from({ length: 7 }, (_, i) => ({ type: "construction", name: i === 2 ? undefined : `Projekt ${i + 1}`, distanceM: 300 }));
  const r = run({ nearby_planned_projects: projects });
  check("projects - count is all of them", r.supportingData.nearbyPlannedProjectsCount, 7);
  check("projects - at most five named, unnamed skipped", r.supportingData.nearbyPlannedProjects, ["Projekt 1", "Projekt 2", "Projekt 4", "Projekt 5"]);
  check("no score/status/weight fields", ["score", "status", "weight", "confidence"].filter((k) => k in r), []);
}

{
  const r = run({ nearby_planned_projects: "garbage" });
  check("non-array - treated as none found", r.supportingData, { nearbyPlannedProjectsCount: 0 });
}

if (failures > 0) {
  console.log(`\n${failures} futureDevelopment check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll futureDevelopment checks passed.");
