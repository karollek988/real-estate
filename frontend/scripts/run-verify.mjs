// Runs every standalone verification script (src/**/*.verify.mjs) one after the other and fails if any of them does.
// The project has no test framework; each *.verify.mjs prints PASS/FAIL lines and exits non-zero when a check fails
// (see the header of any of them). This is the one command that runs them all, locally and in CI:
//
//   npm run verify                 all of them
//   npm run verify -- translate    only the ones whose path contains "translate"
//
// A new script is picked up by its name alone: put it next to the code it checks and call it <name>.verify.mjs.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const filter = process.argv[2]?.toLowerCase();

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith(".verify.mjs")) yield path;
  }
}

const scripts = [...walk(join(root, "src"))]
  .map((path) => relative(root, path).replaceAll("\\", "/"))
  .filter((path) => !filter || path.toLowerCase().includes(filter))
  .sort();

if (scripts.length === 0) {
  console.error(filter ? `No verify script matches "${filter}".` : "No verify scripts found.");
  process.exit(1);
}

const failed = [];
for (const script of scripts) {
  const started = Date.now();
  // tsx lets the .mjs files import the project's TypeScript directly.
  const run = spawnSync(process.execPath, ["--import", "tsx", script], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (run.status === 0) {
    console.log(`ok     ${script} (${seconds}s)`);
    continue;
  }
  failed.push(script);
  console.log(`FAILED ${script} (${seconds}s)`);
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`.trimEnd().split("\n");
  // The failing checks and the end of the output (a crash prints its message last); not the hundreds of PASS lines.
  const interesting = output.filter((line) => /^(FAIL|\s+(expected|actual):)/.test(line));
  const shown = interesting.length > 0 ? interesting.slice(0, 20) : output.slice(-15);
  for (const line of shown) console.log(`       ${line}`);
}

console.log(`\n${scripts.length - failed.length} of ${scripts.length} verify scripts passed.`);
if (failed.length > 0) {
  console.log(`Failed: ${failed.join(", ")}`);
  process.exit(1);
}
