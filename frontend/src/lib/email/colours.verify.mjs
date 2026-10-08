// Standalone verification that the colours written out for e-mail are the master variables, and that the e-mail
// template uses nothing else. No test framework in this project (see the other *.verify.mjs). Run with:
//   npx tsx src/lib/email/colours.verify.mjs
import { readFileSync } from "node:fs";
import { EMAIL_COLOURS } from "./colours.ts";

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

const scss = readFileSync(new URL("../../styles/_variables.scss", import.meta.url), "utf8");
// #fff and #ffffff are the same colour
const full = (hex) => (hex && hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex);
const variable = (name) => full(scss.match(new RegExp(`^\\$${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`, "m"))?.[1]?.toLowerCase() ?? null);

for (const [name, value] of Object.entries(EMAIL_COLOURS)) {
  check(`${name} is the stylesheet's $${name}`, value, variable(name));
}

// the template takes every colour from EMAIL_COLOURS: a colour typed into it would not be checked above
const template = readFileSync(new URL("./confirmationEmail.ts", import.meta.url), "utf8");
check("the e-mail template has no colour of its own", template.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [], []);

if (failures > 0) {
  console.log(`\n${failures} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll e-mail colour checks passed.");
