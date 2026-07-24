// Standalone verification for futureDevelopment.ts (no test framework in this
// project - see helpers.verify.mjs). Covers the three verdict buckets (No
// planned projects, Some development, Active development), the undefined
// data path, and edge cases like empty arrays and null-ish project entries.
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

const baseSources = [
  { id: "municipality_plans", name: "Municipality plans", kind: "placeholder", status: "not_connected", fields: [] },
  { id: "infrastructure_projects", name: "Infrastructure projects", kind: "placeholder", status: "not_connected", fields: [] },
];

const emptyProperty = { id: "", normalizedKey: "", address: "", hemnetUrl: null, latitude: null, longitude: null, municipality: null, postalCode: null, propertyType: null, apartmentNumber: null, floor: null, attributes: {}, fieldProvenance: {}, createdAt: "", updatedAt: "" };

// --- No planning data (attributes key is undefined) ---
{
  const result = futureDevelopmentAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} }, attributes: {}, dataSources: baseSources,
  });
  check("undefined projects - score null", result.score, null);
  check("undefined projects - status", result.status, "No planning data");
  check("undefined projects - confidence", result.confidence, 0.05);
}

// --- No projects found (empty array) ---
{
  const result = futureDevelopmentAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { nearby_planned_projects: [] },
    dataSources: baseSources,
  });
  check("empty projects - score 50", result.score, 50);
  check("empty projects - status", result.status, "No planned projects found nearby");
  check("empty projects - confidence 0.5", result.confidence, 0.5);
}

// --- Some development (1-2 projects) ---
{
  const result = futureDevelopmentAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      nearby_planned_projects: [
        { type: "construction", name: "New housing area", distanceM: 500 },
      ],
    },
    dataSources: baseSources,
  });
  check("1 project - score 54 (50 + 1*4)", result.score, 54);
  check("1 project - status", result.status, "Some development nearby");
  check("1 project - count in supportingData", result.supportingData.nearbyPlannedProjectsCount, 1);
  check("1 project - project name in supportingData", result.supportingData.nearbyPlannedProjects[0], "New housing area");
}

// --- Active development (3+ projects) ---
{
  const result = futureDevelopmentAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      nearby_planned_projects: [
        { type: "construction", name: "Project A" },
        { type: "infrastructure", name: "Project B" },
        { type: "zoning", name: "Project C" },
        { type: "construction", name: "Project D" },
      ],
    },
    dataSources: baseSources,
  });
  check("4 projects - score 66 (50 + 4*4)", result.score, 66);
  check("4 projects - status", result.status, "Active development nearby");
}

// --- Edge: projects capped at 100 (25+ projects) ---
{
  const manyProjects = Array.from({ length: 25 }, (_, i) => ({ type: "construction", name: "Project " + (i + 1) }));
  const result = futureDevelopmentAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { nearby_planned_projects: manyProjects },
    dataSources: baseSources,
  });
  check("25 projects - score capped at 100", result.score, 100);
  check("25 projects - only first 5 names in supportingData", result.supportingData.nearbyPlannedProjects.length, 5);
}

// --- Edge: non-array value (treated as empty array) ---
{
  const result = futureDevelopmentAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: { nearby_planned_projects: "not an array" },
    dataSources: baseSources,
  });
  check("non-array projects - score 50 (treated as empty)", result.score, 50);
  check("non-array projects - count 0", result.supportingData.nearbyPlannedProjectsCount, 0);
}

// --- Edge: projects with no name (filtered from names list but counted) ---
{
  const result = futureDevelopmentAnalyzer.analyze({
    property: emptyProperty, extracted: { attributes: {} },
    attributes: {
      nearby_planned_projects: [
        { type: "construction", distanceM: null },
        { type: "infrastructure", name: "Named project" },
      ],
    },
    dataSources: baseSources,
  });
  check("unnamed project - score 58 (50 + 2*4)", result.score, 58);
  check("unnamed project - only named projects in supportingData", result.supportingData.nearbyPlannedProjects.length, 1);
  check("unnamed project - correct name", result.supportingData.nearbyPlannedProjects[0], "Named project");
}

console.log(failures === 0 ? "\nAll futureDevelopment checks passed." : `\n${failures} futureDevelopment check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
