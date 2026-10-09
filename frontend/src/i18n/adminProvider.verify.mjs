// Standalone verification that the Swedish-only admin console can render the shared client components it uses.
//
// The admin console (src/app/admin) sits outside the language folder, so nothing above it provides next-intl's
// context. A client component that calls useTranslations() with no provider above it throws an Error with an
// EMPTY message in production, and the whole page goes blank ("Uncaught Error", nothing else) - that is how the
// BRF review page broke for everyone. This reads the sources and checks that every client component an admin page
// imports either brings its own NextIntlClientProvider or only uses message areas the admin layout provides (a server
// component reads the request's own i18n config instead, so it is not checked).
// One level only: a component imported by one of those is not followed, so give a component that renders translated
// children its own provider (BrfReviewForm does).
// No test framework in this project (see the other *.verify.mjs). Run with:
//   node src/i18n/adminProvider.verify.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
function check(name, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
  if (!condition) {
    failures++;
    if (detail !== undefined) console.log("  detail:", detail);
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith(".tsx")) yield path;
  }
}

const layout = readFileSync(join(SRC, "app/admin/layout.tsx"), "utf8");
check("the admin layout wraps its pages in a NextIntlClientProvider", layout.includes("<NextIntlClientProvider"));

// the message areas the layout provides: messages={{ brf: brfSv, ... }}
const provided = new Set();
const messagesProp = layout.match(/messages=\{\{([^}]*)\}\}/);
if (messagesProp) for (const part of messagesProp[1].split(",")) {
  const key = part.split(":")[0].trim();
  if (key) provided.add(key);
}
check("the admin layout provides at least one message area", provided.size > 0, [...provided]);

// every component under src/components that an admin page imports
const imported = new Set();
for (const file of walk(join(SRC, "app/admin"))) {
  for (const m of readFileSync(file, "utf8").matchAll(/from\s+"@\/components\/([^"]+)"/g)) imported.add(m[1]);
}
check("the admin pages import shared components (the scan is looking at something)", imported.size > 0);

for (const rel of [...imported].sort()) {
  const file = ["tsx", "ts"].map((ext) => join(SRC, "components", `${rel}.${ext}`)).find(existsSync);
  if (!file) { check(`components/${rel} was found`, false); continue; }
  const source = readFileSync(file, "utf8");
  // A server component reads the request's own i18n config instead of the client provider.
  const isClient = /^\s*["']use client["']/.test(source);
  const usesIntl = isClient && /\buse(Translations|Locale|Formatter|Messages|Now)\b/.test(source);
  if (!usesIntl) { check(`components/${rel} needs no next-intl client context`, true); continue; }
  if (source.includes("<NextIntlClientProvider")) { check(`components/${rel} brings its own provider`, true); continue; }
  const roots = [...source.matchAll(/useTranslations\(\s*["'`]([^"'`.]+)/g)].map((m) => m[1]);
  const bare = /useTranslations\(\s*\)/.test(source);
  check(
    `components/${rel} only uses message areas the admin layout provides (${roots.join(", ") || "none named"})`,
    !bare && roots.every((r) => provided.has(r)) && (roots.length > 0 || !/useTranslations\b/.test(source)),
    { provided: [...provided], roots, bare }
  );
}

process.exit(failures === 0 ? 0 : 1);
