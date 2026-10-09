// Standalone verification for "a full report reaches the customer only after a reviewer has released it"
// (lib/analysis/release.ts + redact.ts's redactPropertyForHold, used by access.ts's getReportForViewer).
// No test framework in this project (see the other *.verify.mjs). Run with:
//   npx tsx src/lib/analysis/release.verify.mjs
import { isHeldForReview, withoutContent } from "./release.ts";
import { redactPropertyForHold } from "./redact.ts";
import { resolveViewScope } from "./access.ts";

let failures = 0;
function check(name, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
  if (!condition) {
    failures++;
    if (detail !== undefined) console.log("  detail:", detail);
  }
}

const LEAK = "LEAK_";

const analysis = (overrides = {}) => ({
  id: "a1",
  propertyId: "p1",
  version: 1,
  engineVersion: "test",
  scope: "full",
  status: "complete",
  report: { property: { address: `${LEAK}report address` }, engineVersion: "test" },
  dataSources: [{ id: `${LEAK}source`, name: "x", kind: "real", status: "ok", fields: [] }],
  error: null,
  failureReason: null,
  createdAt: "2026-10-09T10:00:00.000Z",
  completedAt: "2026-10-09T10:01:00.000Z",
  releasedAt: null,
  ...overrides,
});

// ── who is held ─────────────────────────────────────────────────────────────
check("a finished full report nobody released is held for a full viewer", isHeldForReview(analysis(), "full"));
check(
  "a released full report is not held",
  !isHeldForReview(analysis({ releasedAt: "2026-10-09T12:00:00.000Z" }), "full")
);
check("an area-only viewer of a waiting full report is not held (the area chapter is automatic)", !isHeldForReview(analysis(), "area"));
check(
  "a standalone area analysis is never held",
  !isHeldForReview(analysis({ scope: "area", releasedAt: null }), "area") &&
    !isHeldForReview(analysis({ scope: "area", releasedAt: null }), "full")
);
check("a report still being made is not 'held' (the page shows progress)", !isHeldForReview(analysis({ status: "pending", report: null }), "full"));
check("a failed analysis is not held (the page explains the failure)", !isHeldForReview(analysis({ status: "failed", report: null }), "full"));

// the view scope a buyer gets decides the rest: full entitlement + full analysis = full view
check("full entitlement + full analysis resolves to the full view", resolveViewScope("full", "full") === "full");
check("full entitlement + area analysis resolves to the area view", resolveViewScope("full", "area") === "area");
check("area entitlement + full analysis resolves to the area view", resolveViewScope("area", "full") === "area");
check(
  "so only full entitlement + full analysis can ever be held",
  [
    ["full", "full", true],
    ["full", "area", false],
    ["area", "full", false],
    ["area", "area", false],
  ].every(([entitlement, scope, held]) => isHeldForReview(analysis({ scope }), resolveViewScope(entitlement, scope)) === held)
);

// ── what a held viewer receives ─────────────────────────────────────────────
const stripped = withoutContent(analysis());
check("a held analysis has no report", stripped.report === null);
check("a held analysis has no data sources", Array.isArray(stripped.dataSources) && stripped.dataSources.length === 0);
check("a held analysis still says it is complete and unreleased (so the page can say 'being reviewed')", stripped.status === "complete" && stripped.releasedAt === null);
check("nothing from the report survives in the serialized analysis", !JSON.stringify(stripped).includes(LEAK), JSON.stringify(stripped));

const property = {
  id: "p1",
  normalizedKey: `${LEAK}key`,
  address: "Storgatan 1",
  hemnetUrl: `https://www.hemnet.se/${LEAK}`,
  latitude: 59.3,
  longitude: 18.0,
  municipality: "Stockholm",
  postalCode: "11122",
  propertyType: `${LEAK}type`,
  apartmentNumber: `${LEAK}1101`,
  floor: 3,
  attributes: { asking_price_sek: `${LEAK}4999999`, grocery_count_within_1000m: `${LEAK}12`, housing_association: `${LEAK}Brf Test` },
  fieldProvenance: { asking_price_sek: { source: `${LEAK}hemnet` } },
  createdAt: "2026-10-09T09:00:00.000Z",
  updatedAt: "2026-10-09T09:30:00.000Z",
};
const heldProperty = redactPropertyForHold(property);
check("a held viewer still gets the address they ordered", heldProperty.address === "Storgatan 1");
check("a held viewer gets no listing facts, area attributes or provenance", Object.keys(heldProperty.attributes).length === 0 && Object.keys(heldProperty.fieldProvenance).length === 0);
check("a held viewer gets no listing link, key, coordinates or apartment details",
  heldProperty.hemnetUrl === null && heldProperty.normalizedKey === "" && heldProperty.latitude === null &&
  heldProperty.longitude === null && heldProperty.apartmentNumber === null && heldProperty.propertyType === null && heldProperty.floor === null);
check("nothing from the property survives in the serialized record", !JSON.stringify(heldProperty).includes(LEAK), JSON.stringify(heldProperty));

process.exit(failures === 0 ? 0 : 1);
