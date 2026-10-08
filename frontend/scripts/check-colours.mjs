// Checks that the site takes its colours from the master variables (src/styles/_variables.scss) and not from
// values written into a component or a stylesheet - the "old values" that used to be scattered over the pages.
//
//   npm run colours            lists every colour that is not a master variable and exits 1 if there is one
//
// What counts as the master variables: the ka-* Tailwind colours (bg-ka-cream, text-ka-green-700 ...), which
// app/globals.scss generates from $ka-palette, plus plain white and black, and Sass variables in stylesheets.
//
// Not allowed, anywhere outside EXCEPTIONS below:
//   - Tailwind's own colours: bg-green-600, text-neutral-500, border-red-200 ...
//   - a colour typed into a class: bg-[#12271D], text-[rgb(10,20,30)]
//   - a hex or rgb()/hsl() colour in a .ts/.tsx file (an inline style, an SVG fill ...), except in a shadow
//   - a hex or rgb()/hsl() colour in a stylesheet outside the variable definitions
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");

/**
 * Places that keep colours of their own, and why. A path ending in "/" is a folder.
 * Each entry is a decision, not a gap: add one only with a reason.
 */
const EXCEPTIONS = {
  "styles/_variables.scss": "the master variables themselves",
  "app/[locale]/report/": "the report is a document with its own palette (shared with the PDF)",
  "components/report/": "the report is a document with its own palette (shared with the PDF)",
  "components/sections/ExampleReportSection.tsx": "a picture of that report on the landing page",
  "components/icons.tsx": "other companies' logos (Google, Mastercard, Klarna) keep their own colours",
  "lib/email/colours.ts": "e-mail clients cannot read the stylesheet; lib/email/colours.verify.mjs checks each value against it",
  "pages/admin-portal/index.tsx": "the browser's theme-color tag takes a literal; it is $ka-cream",
};
/** Single colours that are fine where they appear, with the reason. */
const ALLOWED_LITERALS = {
  "#1a0dab": "the title colour of a Google result, in the editor's search preview",
  "#006621": "the address colour of a Google result, in the editor's search preview",
};

const TAILWIND_PALETTES = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTILITIES = "bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|shadow|accent|caret|placeholder|ring-offset";
const RULES = [
  { name: "a Tailwind colour", re: new RegExp(`(?<![\\w-])(?:${UTILITIES})-(?:${TAILWIND_PALETTES})-\\d{2,3}(?![\\w-])`, "g") },
  { name: "a colour typed into a class", re: /\[(?:#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([^\]]*\))\]/g },
  { name: "a hex colour", re: /(?<![\w&\[-])#[0-9a-fA-F]{6}\b|(?<![\w&\[-])#[0-9a-fA-F]{3}\b(?![\w-])/g, notInClass: true },
  { name: "an rgb()/hsl() colour", re: /\b(?:rgba?|hsla?)\(\s*\d/g, notInClass: true },
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(tsx?|scss)$/.test(entry.name) && !/\.verify\.mjs$/.test(entry.name)) yield path;
  }
}

const exceptionFor = (rel) => Object.keys(EXCEPTIONS).find((e) => (e.endsWith("/") ? rel.startsWith(e) : rel === e));

/** Characters of `line` inside a shadow's brackets: a shadow's tint is not a palette colour. */
function inShadow(line, index) {
  const before = line.slice(0, index);
  const open = Math.max(before.lastIndexOf("shadow-["), before.lastIndexOf("drop-shadow-["));
  return open >= 0 && !before.slice(open).includes("]");
}

const found = [];
let files = 0;
for (const file of walk(src)) {
  const rel = relative(src, file).replaceAll("\\", "/");
  if (exceptionFor(rel)) continue;
  files++;
  const stylesheet = rel.endsWith(".scss");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((raw, i) => {
    // a stylesheet's variable definitions and comments are where colours are meant to be written
    let line = raw;
    if (stylesheet) {
      if (/^\s*\$[\w-]+\s*:/.test(line)) return;
      line = line.replace(/\/\/.*$/, "");
    } else if (/^\s*(\/\/|\*|\/\*)/.test(line)) {
      return;
    }
    for (const rule of RULES) {
      if (stylesheet && !rule.notInClass) continue; // class rules do not apply to stylesheets
      for (const match of line.matchAll(rule.re)) {
        const text = match[0];
        // a colour typed into a class comes with its brackets: [#1a0dab]
        if (ALLOWED_LITERALS[text.replace(/^\[|\]$/g, "").toLowerCase()]) continue;
        if (!stylesheet && rule.notInClass && inShadow(line, match.index)) continue;
        // a hex inside a class is reported once, by the class rule
        if (!stylesheet && rule.notInClass && /\[$/.test(line.slice(Math.max(0, match.index - 1), match.index))) continue;
        found.push({ rel, line: i + 1, what: rule.name, text });
      }
    }
  });
}

if (found.length === 0) {
  console.log(`All ${files} source files take their colours from the master variables.`);
  process.exit(0);
}
const byFile = new Map();
for (const f of found) byFile.set(f.rel, [...(byFile.get(f.rel) ?? []), f]);
console.log("Colours that are not master variables (src/styles/_variables.scss):\n");
for (const [rel, list] of [...byFile].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(rel);
  for (const f of list.slice(0, 8)) console.log(`  line ${f.line}: ${f.what}: ${f.text}`);
  if (list.length > 8) console.log(`  ... and ${list.length - 8} more`);
}
console.log(`\n${found.length} colour(s) in ${byFile.size} file(s). Use a ka-* colour (bg-ka-cream, text-ka-green-700 ...), or a $variable in a stylesheet;`);
console.log("a new brand colour goes into styles/_variables.scss first. A place that must keep its own colours is listed in EXCEPTIONS in scripts/check-colours.mjs, with the reason.");
process.exit(1);
