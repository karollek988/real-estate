// Standalone verification for lib/brf/figures.ts + interpret.ts — the BRF
// analysis customers read, built from the figures a Köpanalys reviewer
// published. No test framework in this project (see the other
// *.verify.mjs). Run with:
//   npx tsx src/lib/brf/interpret.verify.mjs
import { EMPTY_BRF_FIGURES, parseBrfFigures, hasAnyBrfFigure } from "./figures.ts";
import { interpretBrf } from "./interpret.ts";

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

const NOW = new Date("2026-10-02T12:00:00Z");
const NBSP = " ";
const flat = (s) => s.replace(/[  ]/g, " ");
const figures = (overrides) => ({ ...EMPTY_BRF_FIGURES, ...overrides });
const apartment = { livingAreaM2: 68, monthlyFeeSek: 4500, buildingYear: 1965 };
const signal = (reading, id) => [...reading.keyFigures, ...reading.loans, ...reading.association].find((s) => s.id === id);

// ── parseBrfFigures: what the review form accepts ────────────────────────────
{
  const { figures: f, errors } = parseBrfFigures({
    debtPerSqmBr: "7 117",
    interestSensitivityPct: "12,9 %",
    savingsPerSqm: "−45",
    isGenuine: "true",
    landTenure: "leasehold",
    numberOfApartments: "42",
    expertComment: "  Stambytet är finansierat med lån.  ",
    unknownField: "dropped",
  });
  check("swedish thousands separator", f.debtPerSqmBr, 7117);
  check("decimal comma and percent sign", f.interestSensitivityPct, 12.9);
  check("unicode minus", f.savingsPerSqm, -45);
  check("boolean from the select", f.isGenuine, true);
  check("land tenure", f.landTenure, "leasehold");
  check("text is trimmed", f.expertComment, "Stambytet är finansierat med lån.");
  check("unknown keys are dropped", "unknownField" in f, false);
  check("valid input has no errors", errors, []);
}
{
  const { figures: f, errors } = parseBrfFigures({ annualFeePerSqm: "69000", numberOfApartments: "4,5", feeShareOfRevenuePct: "abc", landTenure: "rented" });
  check("an implausible fee is rejected, not stored", f.annualFeePerSqm, null);
  check("a fractional count is rejected", f.numberOfApartments, null);
  check("every typing error is reported", errors.length, 4);
}
check("empty figures have nothing to publish", hasAnyBrfFigure(EMPTY_BRF_FIGURES), false);
check("one comment is enough to publish", hasAnyBrfFigure(figures({ expertComment: "Årsredovisningen saknas hos Bolagsverket." })), true);

// ── Benchmarks: every band of every key figure ───────────────────────────────
const tone = (overrides, id) => signal(interpretBrf(figures(overrides), apartment, NOW), id)?.tone;
check("debt 4 000 kr/kvm is low", tone({ debtPerSqmBr: 4000 }, "debt"), "good");
check("debt 7 117 kr/kvm is normal", tone({ debtPerSqmBr: 7117 }, "debt"), "neutral");
check("debt 12 000 kr/kvm is high", tone({ debtPerSqmBr: 12000 }, "debt"), "watch");
check("debt 16 000 kr/kvm is very high", tone({ debtPerSqmBr: 16000 }, "debt"), "alert");
check("total-area debt is used when the bostadsrätt figure is missing", tone({ debtPerSqmTotal: 16000 }, "debt"), "alert");
check("savings below zero", tone({ savingsPerSqm: -20 }, "savings"), "alert");
check("savings 123 kr/kvm (the 2023 average) is low", tone({ savingsPerSqm: 123 }, "savings"), "watch");
check("savings 160 kr/kvm is moderate", tone({ savingsPerSqm: 160 }, "savings"), "neutral");
check("savings 200 kr/kvm is good (HSB, Handelsbanken)", tone({ savingsPerSqm: 200 }, "savings"), "good");
check("savings 300 kr/kvm is good", tone({ savingsPerSqm: 300 }, "savings"), "good");
check("interest sensitivity 3 % is low", tone({ interestSensitivityPct: 3 }, "interestSensitivity"), "good");
check("interest sensitivity 9 % is normal", tone({ interestSensitivityPct: 9 }, "interestSensitivity"), "neutral");
check("interest sensitivity 12 % is high", tone({ interestSensitivityPct: 12 }, "interestSensitivity"), "watch");
check("interest sensitivity 18 % is very high", tone({ interestSensitivityPct: 18 }, "interestSensitivity"), "alert");
check("fee 450 kr/kvm is low (neutral, with a savings caveat)", tone({ annualFeePerSqm: 450 }, "fee"), "neutral");
check("fee 690 kr/kvm is normal", tone({ annualFeePerSqm: 690 }, "fee"), "good");
check("fee 900 kr/kvm is high", tone({ annualFeePerSqm: 900 }, "fee"), "watch");
check("fee 1 118 kr/kvm is very high", tone({ annualFeePerSqm: 1118 }, "fee"), "alert");
check("energy 120 kr/kvm is low", tone({ energyCostPerSqm: 120 }, "energy"), "good");
check("energy 203 kr/kvm is normal", tone({ energyCostPerSqm: 203 }, "energy"), "neutral");
check("energy 283 kr/kvm is high", tone({ energyCostPerSqm: 283 }, "energy"), "watch");
check("energy 320 kr/kvm is very high", tone({ energyCostPerSqm: 320 }, "energy"), "alert");
check("fee share 55 % means a large dependence on other income", tone({ feeShareOfRevenuePct: 55 }, "feeShare"), "watch");
check("fee share 91 % is neutral", tone({ feeShareOfRevenuePct: 91 }, "feeShare"), "neutral");
check("equity ratio 8 % is low", tone({ equityRatioPct: 8 }, "equity"), "watch");

// ── Disclosures ──────────────────────────────────────────────────────────────
check("oäkta förening is flagged", tone({ isGenuine: false }, "genuine"), "alert");
check("tomträtt renegotiated within five years is flagged hardest", tone({ landTenure: "leasehold", leaseholdRenegotiationYear: 2029 }, "land"), "alert");
check("tomträtt renegotiated later is still worth a look", tone({ landTenure: "leasehold", leaseholdRenegotiationYear: 2045 }, "land"), "watch");
check("no maintenance plan", tone({ hasMaintenancePlan: false }, "maintenancePlan"), "watch");
check("audit remark", tone({ auditRemark: true }, "audit"), "alert");
check("planned pipe replacement", tone({ pipesPlannedYear: 2028 }, "pipes"), "watch");
check("pipes replaced", tone({ pipesReplacedYear: 2015 }, "pipes"), "good");
check("an old building with no stated pipe replacement is flagged", tone({}, "pipes"), "watch");
check("a new building with no stated pipe replacement is not", signal(interpretBrf(figures({}), { ...apartment, buildingYear: 2012 }, NOW), "pipes"), undefined);
check("small association", tone({ numberOfApartments: 8 }, "size"), "watch");
check("a decided fee increase", tone({ feeChangePct: 5, feeChangeEffective: "1 januari 2027" }, "feeChange"), "watch");
{
  // An older annual report's "decided" increase that has already taken effect is history, not a coming cost.
  const past = interpretBrf(figures({ feeChangePct: 3, feeChangeEffective: "2025-01-01" }), apartment, NOW);
  check("a fee change already in effect is neutral", signal(past, "feeChange").tone, "neutral");
  check("a fee change already in effect is not a cost for you", past.forYou.some((i) => i.id === "feeChange"), false);
  check("a fee change already in effect is not a concern", past.concerns.length, 1); // only the 1965 building's unstated pipes
  const upcoming = interpretBrf(figures({ feeChangePct: 3, feeChangeEffective: "20270101" }), apartment, NOW);
  check("compact dates are understood", upcoming.forYou.some((i) => i.id === "feeChange"), true);
}

// ── What it means for this home, in kronor ───────────────────────────────────
{
  const r = interpretBrf(figures({ debtPerSqmBr: 6618, interestSensitivityPct: 6, feeChangePct: 10, annualFeePerSqm: 832 }), apartment, NOW);
  const impact = (id) => r.forYou.find((i) => i.id === id);
  check("share of the association's debt: 6 618 kr/kvm × 68 kvm ≈ 450 000 kr", flat(impact("shareOfDebt").value), "cirka 450 000 kr");
  check("+1 percentage point: 4 500 kr × 6 % = 270 kr/month", flat(impact("rateRise").value), "+270 kr/mån");
  check("decided +10 %: 450 kr/month more", flat(impact("feeChange").value), "+450 kr/mån");
  check("the home's own fee per kvm: 4 500 × 12 / 68 ≈ 794", flat(impact("ownFeeLevel").value), "794 kr/kvm och år");
  check("a fee well within the association's average is not flagged", impact("ownFeeLevel").tone, "neutral");
}
{
  const r = interpretBrf(figures({ debtPerSqmBr: 6618 }), { livingAreaM2: null, monthlyFeeSek: null, buildingYear: null }, NOW);
  check("without the home's size and fee there is nothing to say in kronor", r.forYou, []);
}

// ── Summary lines, missing figures and questions ─────────────────────────────
{
  const r = interpretBrf(
    figures({ fiscalYear: 2024, debtPerSqmBr: 2008, savingsPerSqm: 249, interestSensitivityPct: 2.6, annualFeePerSqm: 779, energyCostPerSqm: 228, feeShareOfRevenuePct: 95, isGenuine: true, hasMaintenancePlan: true, pipesReplacedYear: 2001 }),
    apartment,
    NOW
  );
  check("a sound association: no concerns", r.concerns, []);
  check("strengths name the verdict and the value", flat(r.strengths[0]), "Låg skuldsättning (2 008 kr/kvm)");
  check("nothing mandatory is missing", r.missingKeyFigures, []);
  check("the standing question is always asked", r.questions.includes("Finns det beslut eller planer på avgiftshöjningar som inte syns i årsredovisningen?"), true);
  check("no maintenance-plan question when the plan exists", r.questions.some((q) => q.includes("underhållsplan")), false);
}
{
  const r = interpretBrf(figures({ fiscalYear: 2022, landTenure: "leasehold", savingsPerSqm: 40, debtRenegotiatedWithin12mPct: 70 }), apartment, NOW);
  check("missing key figures are named", r.missingKeyFigures.includes("räntekänslighet") && r.missingKeyFigures.includes("årsavgift per kvm"), true);
  check("one debt figure is enough: total debt is not listed as missing twice", r.missingKeyFigures.filter((m) => m.startsWith("skuldsättning")).length, 1);
  check("old annual report -> ask for a newer one", r.questions[0], "Finns det en nyare årsredovisning än den för 2022?");
  check("leasehold question", r.questions.some((q) => q.includes("tomträttsavgälden")), true);
  check("low savings question", r.questions.some((q) => q.includes("sparandet är lågt")), true);
  check("renegotiation question", r.questions.some((q) => q.includes("omförhandlas det närmaste året")), true);
  check("pipe question for a 1965 building without a stated replacement", r.questions.some((q) => q.includes("stambytet")), true);
}

// ── Plain language: no rating words, no advice, no unformatted numbers ───────
{
  const r = interpretBrf(
    figures({ debtPerSqmBr: 12000, savingsPerSqm: -10, interestSensitivityPct: 16, annualFeePerSqm: 1100, energyCostPerSqm: 310, feeShareOfRevenuePct: 50, equityRatioPct: 5, isGenuine: false, landTenure: "leasehold", leaseholdRenegotiationYear: 2027, hasMaintenancePlan: false, auditRemark: true, pipesPlannedYear: 2027, plannedRenovations: "Tak 2028", feeChangePct: 15, numberOfApartments: 6, interestBearingDebtSek: 25000000, averageInterestRatePct: 3.4, debtRenegotiatedWithin12mPct: 60 }),
    apartment,
    NOW
  );
  const text = [
    ...[...r.keyFigures, ...r.loans, ...r.association].flatMap((s) => [s.value, s.verdict, s.meaning, s.benchmark ?? ""]),
    ...r.forYou.flatMap((i) => [i.label, i.explanation]),
    ...r.questions,
  ].join("\n");
  const banned = [/rekommender/i, /\bbör\b/i, /köpvärt/i, /\bbetyg\b/i, /\d+\s*\/\s*100\b/, /\bpoäng\b/i, /undvik/i, /\bköp inte\b/i];
  check("no advice or rating language in any BRF text", banned.filter((b) => b.test(text)).map(String), []);
  check("amounts use Swedish grouping with a non-breaking space", text.includes(`25${NBSP}000${NBSP}000${NBSP}kr`), true);
  check("everything flagged shows up as a concern", r.concerns.length >= 12, true);
}

if (failures > 0) {
  console.log(`\n${failures} BRF interpretation check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll BRF interpretation checks passed.");
