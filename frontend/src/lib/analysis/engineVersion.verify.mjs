// Standalone verification for fix #3 (cache versioning). Run with:
//   node --experimental-strip-types src/lib/analysis/engineVersion.verify.mjs
//
// Plain `node` can't resolve buildAnalysis.ts's own extensionless relative
// imports (decisionEngine, analyzers/...) the way tsc/Next's bundler does,
// so this re-derives ENGINE_VERSION from the same two literals rather than
// importing the module graph. This is a runner limitation, not a product
// bug: confirm engine/buildAnalysis.ts's own TS_ENGINE_VERSION/
// PYTHON_ENGINE_VERSION/ENGINE_VERSION match these before trusting this run.
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./engine/buildAnalysis.ts", import.meta.url), "utf8");
const TS_ENGINE_VERSION = src.match(/TS_ENGINE_VERSION = "([^"]+)"/)?.[1];
const PYTHON_ENGINE_VERSION = src.match(/PYTHON_ENGINE_VERSION = "([^"]+)"/)?.[1];
const ENGINE_VERSION = src.match(/export const ENGINE_VERSION = `([^`]+)`/)?.[1]
  ?.replace("${TS_ENGINE_VERSION}", TS_ENGINE_VERSION)
  ?.replace("${PYTHON_ENGINE_VERSION}", PYTHON_ENGINE_VERSION);

if (!TS_ENGINE_VERSION || !PYTHON_ENGINE_VERSION || !ENGINE_VERSION) {
  console.log("FAIL - could not locate version constants in buildAnalysis.ts (source format changed?)");
  process.exit(1);
}

let failures = 0;
function check(name, condition) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
  if (!condition) failures++;
}

// The exact pipeline.ts::requestAnalysis freshness predicate.
function isFresh(cachedEngineVersion) {
  return cachedEngineVersion === ENGINE_VERSION;
}

check("ENGINE_VERSION combines both halves", ENGINE_VERSION === `${TS_ENGINE_VERSION}+py${PYTHON_ENGINE_VERSION}`);

// Every analysis ever persisted before this fix shipped stored a bare TS
// version string (e.g. "0.3.0") as engine_version - none of them can match
// the new combined format, so they all correctly invalidate.
check("a pre-fix cached analysis (bare old TS version) is treated as stale", !isFresh("0.3.0"));

// A same-version cached analysis is still served (no unnecessary re-runs).
check("a cached analysis on the current engine version is treated as fresh", isFresh(ENGINE_VERSION));

// Bumping either half must invalidate every previously cached analysis.
const bumpedPython = `${TS_ENGINE_VERSION}+py1.0.1`;
check("a Python-only version bump invalidates old cache", !isFresh(bumpedPython));
const bumpedTs = `0.4.1+py${PYTHON_ENGINE_VERSION}`;
check("a TS-only version bump invalidates old cache", !isFresh(bumpedTs));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
