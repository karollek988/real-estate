// Standalone verification for screenshotExtract.ts — no test framework in
// this project (see hemnetPage.verify.mjs). Run with:
//   node --experimental-strip-types src/lib/analysis/listing/screenshotExtract.verify.mjs
import { extractFromScreenshotText } from "./screenshotExtract.ts";

let failures = 0;
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "PASS" : "FAIL"} - ${name}`);
  if (!pass) {
    console.log("  expected:", JSON.stringify(expected));
    console.log("  actual:  ", JSON.stringify(actual));
    failures++;
  }
}

// A realistic single-screenshot OCR dump: labeled price/fee/area, address
// as the first line, some UI chrome noise mixed in.
{
  const text = [
    "Vasagatan 21",
    "Vasastan, Göteborgs kommun",
    "Bostadsrätt · 3 rum, 65,5 m²",
    "Utgångspris 4 500 000 kr",
    "Avgift/månad 3 200 kr",
    "Byggår 1965",
    "Våning 4 av 6",
    "Energiklass C",
  ].join("\n");
  const { fields, foundKeys } = extractFromScreenshotText([text]);
  check("address", fields.address, "Vasagatan 21");
  check("askingPrice", fields.askingPrice, 4_500_000);
  check("monthlyFee", fields.monthlyFee, 3200);
  check("livingArea", fields.livingArea, 65.5);
  check("rooms", fields.rooms, 3);
  check("buildingYear", fields.buildingYear, 1965);
  check("floor", fields.floor, 4);
  check("energyClass", fields.energyClass, "C");
  check("propertyType", fields.propertyType, "Bostadsrätt");
  check(
    "foundKeys has all 9",
    foundKeys.sort(),
    [
      "address",
      "askingPrice",
      "buildingYear",
      "energyClass",
      "floor",
      "livingArea",
      "monthlyFee",
      "propertyType",
      "rooms",
    ].sort()
  );
}

// No explicit "Utgångspris" label — falls back to the bare "N NNN NNN kr" pattern.
{
  const { fields } = extractFromScreenshotText(["Storgatan 5\n3 950 000 kr\n55 m²"]);
  check("fallback price", fields.askingPrice, 3_950_000);
  check("fallback area", fields.livingArea, 55);
}

// Multiple screenshots: fields split across images should still combine.
{
  const { fields } = extractFromScreenshotText([
    "Drottninggatan 45\nÄganderätt",
    "Utgångspris 6 200 000 kr\nBoarea 120 m²",
  ]);
  check("multi-image address", fields.address, "Drottninggatan 45");
  check("multi-image propertyType", fields.propertyType, "Äganderätt");
  check("multi-image price", fields.askingPrice, 6_200_000);
  check("multi-image area", fields.livingArea, 120);
}

// Garbage/unrelated OCR text — nothing should be (falsely) extracted.
{
  const { fields, foundKeys } = extractFromScreenshotText(["asdf qwer 12 lorem ipsum photo of a cat"]);
  check("garbage yields no fields", fields, {});
  check("garbage yields no foundKeys", foundKeys, []);
}

// Empty/whitespace-only OCR result (unreadable image).
{
  const { fields, foundKeys } = extractFromScreenshotText(["", "   "]);
  check("empty text yields no fields", fields, {});
  check("empty text yields no foundKeys", foundKeys, []);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
