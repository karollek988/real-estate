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
// as the first line, some UI chrome noise mixed in. The address now
// combines with the following "...kommun" line, giving the same shape a
// manually-typed address would have.
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
  check("address", fields.address, "Vasagatan 21, Vasastan, Göteborgs kommun");
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

// No explicit "Utgångspris" label, and no "boarea" label at all - both
// fall back to the single unambiguous candidate for their unit.
{
  const { fields } = extractFromScreenshotText(["Storgatan 5\n3 950 000 kr\n55 m²"]);
  check("fallback price", fields.askingPrice, 3_950_000);
  check("fallback area", fields.livingArea, 55);
}

// Multiple screenshots: fields split across images should still combine.
// No "kommun" line follows the address here, so no combination happens.
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

// Real bug repro: a two-column listing whose OCR interleaved the
// broker/viewing-time panel ahead of the header, and whose price appears as
// a bare heading (no "Utgångspris:" label) alongside a separate "Pris/m²"
// figure. Neither the viewing-time line nor the per-m2 price should win -
// and the address now resolves correctly via the street-suffix heuristic
// (it has no digit, so the old digit-requiring fallback could never find it).
{
  const text = [
    "fa] Sön 27 sep kl 15:00-16:00 >",
    "Augustendalsvägen",
    "Nacka strand, Nacka kommun",
    "11 495 000 kr",
    "Boarea 119 m²",
    "Pris/m²",
    "96 597 kr/m²",
  ].join("\n");
  const { fields } = extractFromScreenshotText([text]);
  check("real address found despite viewing-time noise", fields.address, "Augustendalsvägen, Nacka strand, Nacka kommun");
  check("real price wins over price-per-m2", fields.askingPrice, 11_495_000);
}

// Same trap, but the per-m2/per-month figures appear BEFORE the real price
// in reading order (largest-candidate selection must not depend on order),
// and "Pris/m2" is glued onto one line with no space before the label.
{
  const text = [
    "Pris/m2 96 597 kr/m2",
    "Avgift 7 660 kr/mån",
    "11 495 000 kr",
    "Boarea 119 m²",
  ].join("\n");
  const { fields } = extractFromScreenshotText([text]);
  check("order-independent: real price still wins", fields.askingPrice, 11_495_000);
  check("order-independent: real fee still extracted", fields.monthlyFee, 7660);
}

// "Slutpris" (sold price) is trusted as an explicit label, same as
// "Utgångspris" - bare "Pris" deliberately is not.
{
  const { fields } = extractFromScreenshotText(["Slutpris 5 100 000 kr\nPris/m² 42 000 kr/m²"]);
  check("slutpris label trusted", fields.askingPrice, 5_100_000);
}

// No trusted label at all ("Pris:" alone, not "Utgångspris"/"Slutpris") -
// still resolves correctly via the largest-non-rate-figure fallback.
{
  const { fields } = extractFromScreenshotText(["Pris: 2 950 000 kr\nAvgift 2 100 kr/mån"]);
  check("bare 'pris' label ignored but fallback still finds the real price", fields.askingPrice, 2_950_000);
}

// Driftskostnader gets its own extraction now, independent of avgift.
{
  const { fields } = extractFromScreenshotText(["Driftskostnader 1 800 kr/mån\nAvgift 3 500 kr/mån"]);
  check("operatingCosts labeled directly", fields.operatingCosts, 1800);
  check("monthlyFee labeled directly", fields.monthlyFee, 3500);
}

// Avgift and Driftskostnader both present but neither near its own value
// (simulating a scrambled two-column table) and two indistinguishable
// kr/mån figures left over - correctly left blank rather than guessing
// which figure belongs to which label.
{
  const text = "Avgift\nDriftskostnader\nBalkong\nHiss\nParkering\n7 660 kr/mån\n1 800 kr/mån";
  const { fields } = extractFromScreenshotText([text]);
  check("ambiguous fee left blank rather than guessed", fields.monthlyFee, undefined);
  check("ambiguous operating cost left blank rather than guessed", fields.operatingCosts, undefined);
}

// Floor via the "N, hiss finns" shape even when "Våning" itself is far away.
{
  const text = "Våning\nBostadstyp\nLägenhet\n9, hiss finns";
  const { fields } = extractFromScreenshotText([text]);
  check("floor found via 'hiss finns' shape", fields.floor, 9);
}

// Balcony/elevator/parking are tags that only ever appear when true.
{
  const { fields } = extractFromScreenshotText(["Premium Nyproduktion Balkong Hiss"]);
  check("balcony tag", fields.balcony, "Ja");
  check("elevator tag", fields.elevator, "Ja");
  check("parking absent stays blank", fields.parking, undefined);
}

// A negated mention must never read as a positive tag.
{
  const { fields } = extractFromScreenshotText(["Ingen hiss\nBalkong saknas"]);
  check("negated elevator mention ignored", fields.elevator, undefined);
}

// Known agency brand, case-insensitive regardless of how OCR cased it.
{
  const { fields } = extractFromScreenshotText(["FANTASTIC FRANK\nMadeleine Almkvist\nMejla"]);
  check("known agency recognized", fields.agency, "Fantastic Frank");
  check("broker name near contact panel", fields.broker, "Madeleine Almkvist");
}

// Full reconstruction of the real Augustendalsvägen listing (Nacka strand)
// from the screenshots this extractor was debugged against - checks that
// most fields now come through, not just the two that worked before.
{
  const text = [
    "Augustendalsvägen",
    "Nacka strand, Nacka kommun",
    "Visa på karta",
    "11 495 000 kr",
    "Om bostaden",
    "Bostadstyp",
    "Lägenhet",
    "Antal rum",
    "5 rum",
    "Boarea",
    "119 m²",
    "Våning",
    "9, hiss finns",
    "Avgift",
    "7 660 kr/mån",
    "Se alla detaljer",
    "Premium Nyproduktion Balkong Hiss",
    "Madeleine Almkvist",
    "Mejla",
    "Visa telefonnummer",
    "FANTASTIC FRANK",
    "Visningstider",
    "Sön 27 sep kl 15:00-16:00",
    "Till anmälan och mer info >",
    "Pris/m²",
    "96 597 kr/m²",
  ].join("\n");
  const { fields, foundKeys } = extractFromScreenshotText([text]);
  check("real listing: address", fields.address, "Augustendalsvägen, Nacka strand, Nacka kommun");
  check("real listing: price", fields.askingPrice, 11_495_000);
  check("real listing: fee", fields.monthlyFee, 7660);
  check("real listing: area", fields.livingArea, 119);
  check("real listing: rooms", fields.rooms, 5);
  check("real listing: floor", fields.floor, 9);
  check("real listing: balcony", fields.balcony, "Ja");
  check("real listing: elevator", fields.elevator, "Ja");
  check("real listing: agency", fields.agency, "Fantastic Frank");
  check("real listing: broker", fields.broker, "Madeleine Almkvist");
  // Genuinely absent from this crop, not a bug: no "Bostadsrätt"/"Byggår"/
  // "Energiklass"/"Driftskostnader"/parking tag anywhere in the OCR text.
  check("real listing: propertyType correctly unset (not visible in this crop)", fields.propertyType, undefined);
  check("real listing: at least 9 fields found", foundKeys.length >= 9, true);
}

// Empty/whitespace-only OCR result (unreadable image).
{
  const { fields, foundKeys } = extractFromScreenshotText(["", "   "]);
  check("empty text yields no fields", fields, {});
  check("empty text yields no foundKeys", foundKeys, []);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
