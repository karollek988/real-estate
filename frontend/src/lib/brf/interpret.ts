import type { BrfFigures } from "./figures";
import { MANDATORY_KEY_FIGURES } from "./figures";
import type { TextKit } from "../../i18n/textKit";
// Runtime imports in this file are relative, not "@/..." - the verify scripts run it directly with tsx.

/**
 * Turns the figures a Köpanalys reviewer recorded from an annual report
 * (figures.ts) into the BRF analysis the buyer reads: each key figure in plain
 * language, what it means, how it compares with what is usually considered low
 * or high, and what it means in kronor for this particular home.
 *
 * The benchmarks are the levels Swedish banks and the large housing
 * organisations publish for buyers, and the national averages come from Nabo's
 * analysis of 2 250 associations' annual reports for 2023 (the first year the
 * key figures were mandatory). Sources and the date they were checked are in
 * the "brf.sources" text; docs/48 has the full table. A tone is a reading of one
 * figure against those levels — there is no overall score or verdict.
 *
 * Every sentence is a message (src/i18n/messages/<language>/brf.ts): this module
 * decides WHICH sentence applies and fills in the numbers, a language only has
 * to translate the sentences. It takes a text kit (src/i18n/textKit.ts) so it runs
 * the same on the server, in the browser (the review console's live preview and the
 * example report) and under tsx (the verify scripts).
 */

export type Tone = "good" | "neutral" | "watch" | "alert";

export interface BrfSignal {
  id: string;
  /** A fixed code for the few signals the report logic looks at ("leasehold"); null for the rest. */
  code?: string;
  label: string;
  value: string;
  /** Short reading of the value, e.g. "Normal skuldsättning". */
  verdict: string;
  tone: Tone;
  /** What the figure is, in plain language. */
  meaning: string;
  /** What is usually considered low or high, with the national average where known. */
  benchmark: string | null;
  /** The one-line form used in the summary lists ("Hög skuldsättning (11 400 kr/kvm)"). */
  summary: string;
}

/** What a figure means for this home in kronor — the costs that are easy to miss. */
export interface BrfImpact {
  id: string;
  label: string;
  value: string;
  explanation: string;
  tone: Tone;
}

export interface BrfReading {
  fiscalYear: number | null;
  keyFigures: BrfSignal[];
  loans: BrfSignal[];
  association: BrfSignal[];
  forYou: BrfImpact[];
  /** One line per figure that reads well, for the summary. */
  strengths: string[];
  /** One line per figure worth a closer look, for the summary and the risk chapter. */
  concerns: string[];
  /** Mandatory key figures the annual report did not state (or the reviewer did not record). */
  missingKeyFigures: string[];
  /** Questions to put to the board or the broker, derived from the figures and from what is missing. */
  questions: string[];
  expertComment: string | null;
}

/** The facts about the home itself that turn association figures into kronor for the buyer. */
export interface BrfApartmentContext {
  livingAreaM2: number | null;
  monthlyFeeSek: number | null;
  buildingYear: number | null;
}

/* ── Formatting ──────────────────────────────────────────────────────── */

/** The number-and-unit helpers, bound to one language. Amounts are written with the language's own currency text ("12 000 kr", "SEK 12,000"). */
function formatters(kit: TextKit) {
  const grouped = (value: number, decimals = 0) =>
    new Intl.NumberFormat(kit.formatLocale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  const kr = (value: number) => kit.t("brf.format.kr", { value: grouped(Math.round(value)) }) as string;
  const krPerSqm = (value: number) => kit.t("brf.format.krPerSqm", { value: grouped(Math.round(value)) }) as string;
  const percent = (value: number) => kit.t("brf.format.percent", { value: grouped(value, Number.isInteger(value) ? 0 : 1) }) as string;
  const signedKr = (value: number) => {
    const rounded = Math.round(value);
    const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
    return kit.t("brf.format.signedKr", { sign, value: grouped(Math.abs(rounded)) }) as string;
  };
  /** Rounds a large amount for prose ("cirka 520 000 kr") — never more precise than the inputs. */
  const roughKr = (value: number) => {
    const magnitude = Math.abs(value) >= 100_000 ? 10_000 : Math.abs(value) >= 10_000 ? 1_000 : 100;
    return kr(Math.round(value / magnitude) * magnitude);
  };
  return { grouped, kr, krPerSqm, percent, signedKr, roughKr };
}

type Format = ReturnType<typeof formatters>;

/* ── Key figures ─────────────────────────────────────────────────────── */

type Draft = Omit<BrfSignal, "summary"> & { summary?: string };

function debtSignal(f: BrfFigures, apartment: BrfApartmentContext, thisYear: number, kit: TextKit, fx: Format): Draft | null {
  const t = kit.t;
  const value = f.debtPerSqmBr ?? f.debtPerSqmTotal;
  if (value === null) return null;
  const perBr = f.debtPerSqmBr !== null;
  const [tone, verdict]: [Tone, string] =
    value < 5000
      ? ["good", t("brf.signals.debt.low")]
      : value < 10000
        ? ["neutral", t("brf.signals.debt.normal")]
        : value < 15000
          ? ["watch", t("brf.signals.debt.high")]
          : ["alert", t("brf.signals.debt.veryHigh")];
  const newBuilding = apartment.buildingYear !== null && thisYear - apartment.buildingYear <= 15;
  return {
    id: "debt",
    label: perBr ? t("brf.signals.debt.label") : t("brf.signals.debt.labelTotal"),
    value: fx.krPerSqm(value),
    verdict,
    tone,
    meaning: t("brf.signals.debt.meaning") + (newBuilding ? ` ${t("brf.signals.debt.meaningNewBuilding")}` : ""),
    benchmark: t("brf.signals.debt.benchmark"),
  };
}

function savingsSignal(f: BrfFigures, kit: TextKit, fx: Format): Draft | null {
  const t = kit.t;
  const value = f.savingsPerSqm;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value < 0
      ? ["alert", t("brf.signals.savings.negative")]
      : value < 130
        ? ["watch", t("brf.signals.savings.low")]
        : value < 200
          ? ["neutral", t("brf.signals.savings.moderate")]
          : ["good", t("brf.signals.savings.good")];
  return {
    id: "savings",
    label: t("brf.signals.savings.label"),
    value: fx.krPerSqm(value),
    verdict,
    tone,
    meaning: t("brf.signals.savings.meaning"),
    benchmark: t("brf.signals.savings.benchmark"),
  };
}

function interestSensitivitySignal(f: BrfFigures, kit: TextKit, fx: Format): Draft | null {
  const t = kit.t;
  const value = f.interestSensitivityPct;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value < 5
      ? ["good", t("brf.signals.interestSensitivity.low")]
      : value < 10
        ? ["neutral", t("brf.signals.interestSensitivity.normal")]
        : value < 15
          ? ["watch", t("brf.signals.interestSensitivity.high")]
          : ["alert", t("brf.signals.interestSensitivity.veryHigh")];
  return {
    id: "interestSensitivity",
    label: t("brf.signals.interestSensitivity.label"),
    value: fx.percent(value),
    verdict,
    tone,
    meaning: t("brf.signals.interestSensitivity.meaning", { value: fx.percent(value) }),
    benchmark: t("brf.signals.interestSensitivity.benchmark"),
  };
}

function feeSignal(f: BrfFigures, kit: TextKit, fx: Format): Draft | null {
  const t = kit.t;
  const value = f.annualFeePerSqm;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value < 500
      ? ["neutral", t("brf.signals.fee.low")]
      : value < 850
        ? ["good", t("brf.signals.fee.normal")]
        : value < 1000
          ? ["watch", t("brf.signals.fee.high")]
          : ["alert", t("brf.signals.fee.veryHigh")];
  return {
    id: "fee",
    label: t("brf.signals.fee.label"),
    value: fx.krPerSqm(value),
    verdict,
    tone,
    meaning: t("brf.signals.fee.meaning") + (value < 500 ? ` ${t("brf.signals.fee.meaningLow")}` : ""),
    benchmark: t("brf.signals.fee.benchmark"),
  };
}

function energySignal(f: BrfFigures, kit: TextKit, fx: Format): Draft | null {
  const t = kit.t;
  const value = f.energyCostPerSqm;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value < 150
      ? ["good", t("brf.signals.energy.low")]
      : value < 250
        ? ["neutral", t("brf.signals.energy.normal")]
        : value < 300
          ? ["watch", t("brf.signals.energy.high")]
          : ["alert", t("brf.signals.energy.veryHigh")];
  return {
    id: "energy",
    label: t("brf.signals.energy.label"),
    value: fx.krPerSqm(value),
    verdict,
    tone,
    meaning: t("brf.signals.energy.meaning"),
    benchmark: t("brf.signals.energy.benchmark"),
  };
}

function feeShareSignal(f: BrfFigures, kit: TextKit, fx: Format): Draft | null {
  const t = kit.t;
  const value = f.feeShareOfRevenuePct;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value >= 85
      ? ["neutral", t("brf.signals.feeShare.mostly")]
      : value >= 60
        ? ["neutral", t("brf.signals.feeShare.other")]
        : ["watch", t("brf.signals.feeShare.dependent")];
  return {
    id: "feeShare",
    label: t("brf.signals.feeShare.label"),
    value: fx.percent(value),
    verdict,
    tone,
    meaning: t("brf.signals.feeShare.meaning"),
    benchmark: t("brf.signals.feeShare.benchmark"),
  };
}

function equitySignal(f: BrfFigures, kit: TextKit, fx: Format): Draft | null {
  const t = kit.t;
  const value = f.equityRatioPct;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value < 10
      ? ["watch", t("brf.signals.equity.low")]
      : value < 50
        ? ["neutral", t("brf.signals.equity.moderate")]
        : ["neutral", t("brf.signals.equity.high")];
  return {
    id: "equity",
    label: t("brf.signals.equity.label"),
    value: fx.percent(value),
    verdict,
    tone,
    meaning: t("brf.signals.equity.meaning"),
    benchmark: null,
  };
}

/* ── Loans ───────────────────────────────────────────────────────────── */

function loanSignals(f: BrfFigures, kit: TextKit, fx: Format): Draft[] {
  const t = kit.t;
  const signals: Draft[] = [];
  if (f.interestBearingDebtSek !== null) {
    signals.push({
      id: "totalDebt",
      label: t("brf.signals.totalDebt.label"),
      value: fx.kr(f.interestBearingDebtSek),
      verdict: t("brf.signals.totalDebt.verdict"),
      tone: "neutral",
      meaning: t("brf.signals.totalDebt.meaning"),
      benchmark: null,
    });
  }
  if (f.averageInterestRatePct !== null) {
    signals.push({
      id: "averageRate",
      label: t("brf.signals.averageRate.label"),
      value: fx.percent(f.averageInterestRatePct),
      verdict: t("brf.signals.averageRate.verdict"),
      tone: "neutral",
      meaning: t("brf.signals.averageRate.meaning"),
      benchmark: null,
    });
  }
  if (f.debtRenegotiatedWithin12mPct !== null) {
    const value = f.debtRenegotiatedWithin12mPct;
    signals.push({
      id: "renegotiation",
      label: t("brf.signals.renegotiation.label"),
      value: fx.percent(value),
      verdict: value >= 50 ? t("brf.signals.renegotiation.soon") : t("brf.signals.renegotiation.share"),
      summary: t("brf.signals.renegotiation.summary", { value: fx.percent(value) }),
      tone: value >= 50 ? "watch" : "neutral",
      meaning: t("brf.signals.renegotiation.meaning"),
      benchmark: null,
    });
  }
  return signals;
}

/* ── The association and what is planned ─────────────────────────────── */

const MONTHS_SV = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];

/**
 * When a decided fee change applies: "2025-01-01", "20250101" or
 * "1 januari 2027" (the reviewer writes it by hand, in Swedish). Anything else is read as upcoming, as the reviewer wrote it.
 */
export function parseEffectiveDate(text: string | null): Date | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  let m = t.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  m = t.match(/^(\d{1,2})\s+([a-zåäö]+)\s+(\d{4})$/);
  if (m) {
    const month = MONTHS_SV.indexOf(m[2]);
    if (month >= 0) return new Date(Date.UTC(Number(m[3]), month, Number(m[1])));
  }
  return null;
}

/**
 * The date a fee change takes effect, as it is shown. The reviewer wrote it in Swedish; for a Swedish reader it is
 * shown as written, for a reader of another language a date that can be read is written out in their language.
 */
function effectiveLabel(text: string | null, kit: TextKit): string | null {
  if (!text) return null;
  if (kit.locale === "sv") return text;
  const date = parseEffectiveDate(text);
  return date ? date.toLocaleDateString(kit.formatLocale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : text;
}

/** A change an older annual report announced that has already taken effect — most likely already in the listing's fee. */
function feeChangeAlreadyApplied(f: BrfFigures, now: Date): boolean {
  const date = parseEffectiveDate(f.feeChangeEffective);
  return date !== null && date.getTime() <= now.getTime();
}

function associationSignals(f: BrfFigures, apartment: BrfApartmentContext, thisYear: number, now: Date, kit: TextKit, fx: Format): Draft[] {
  const t = kit.t;
  const signals: Draft[] = [];

  if (f.isGenuine !== null) {
    signals.push(
      f.isGenuine
        ? {
            id: "genuine",
            label: t("brf.signals.genuine.label"),
            value: t("brf.signals.genuine.yes"),
            verdict: t("brf.signals.genuine.yesVerdict"),
            summary: t("brf.signals.genuine.yesSummary"),
            tone: "good",
            meaning: t("brf.signals.genuine.yesMeaning"),
            benchmark: null,
          }
        : {
            id: "genuine",
            label: t("brf.signals.genuine.label"),
            value: t("brf.signals.genuine.no"),
            verdict: t("brf.signals.genuine.noVerdict"),
            summary: t("brf.signals.genuine.noSummary"),
            tone: "alert",
            meaning: t("brf.signals.genuine.noMeaning"),
            benchmark: null,
          }
    );
  }

  if (f.landTenure === "owned") {
    signals.push({
      id: "land",
      code: "owned",
      label: t("brf.signals.land.label"),
      value: t("brf.signals.land.owned"),
      verdict: t("brf.signals.land.ownedVerdict"),
      summary: t("brf.signals.land.ownedSummary"),
      tone: "good",
      meaning: t("brf.signals.land.ownedMeaning"),
      benchmark: null,
    });
  } else if (f.landTenure === "leasehold") {
    const year = f.leaseholdRenegotiationYear;
    const soon = year !== null && year - thisYear <= 5;
    signals.push({
      id: "land",
      code: "leasehold",
      label: t("brf.signals.land.label"),
      value: t("brf.signals.land.leasehold"),
      verdict: year !== null ? t("brf.signals.land.leaseholdVerdictYear", { year }) : t("brf.signals.land.leaseholdVerdict"),
      summary: year !== null ? t("brf.signals.land.leaseholdSummaryYear", { year }) : t("brf.signals.land.leaseholdSummary"),
      tone: soon ? "alert" : "watch",
      meaning: t("brf.signals.land.leaseholdMeaning") + (year !== null ? ` ${t("brf.signals.land.leaseholdMeaningYear", { year })}` : ""),
      benchmark: null,
    });
  }

  if (f.hasMaintenancePlan !== null) {
    signals.push(
      f.hasMaintenancePlan
        ? {
            id: "maintenancePlan",
            label: t("brf.signals.maintenancePlan.label"),
            value: t("brf.signals.maintenancePlan.yes"),
            verdict: t("brf.signals.maintenancePlan.yesVerdict"),
            summary: t("brf.signals.maintenancePlan.yesSummary"),
            tone: "good",
            meaning: t("brf.signals.maintenancePlan.yesMeaning"),
            benchmark: null,
          }
        : {
            id: "maintenancePlan",
            label: t("brf.signals.maintenancePlan.label"),
            value: t("brf.signals.maintenancePlan.no"),
            verdict: t("brf.signals.maintenancePlan.noVerdict"),
            summary: t("brf.signals.maintenancePlan.noSummary"),
            tone: "watch",
            meaning: t("brf.signals.maintenancePlan.noMeaning"),
            benchmark: null,
          }
    );
  }

  if (f.pipesPlannedYear !== null) {
    signals.push({
      id: "pipes",
      label: t("brf.signals.pipes.label"),
      value: t("brf.signals.pipes.planned", { year: f.pipesPlannedYear }),
      verdict: t("brf.signals.pipes.plannedVerdict"),
      summary: t("brf.signals.pipes.plannedSummary", { year: f.pipesPlannedYear }),
      tone: "watch",
      meaning: t("brf.signals.pipes.plannedMeaning"),
      benchmark: null,
    });
  } else if (f.pipesReplacedYear !== null) {
    signals.push({
      id: "pipes",
      label: t("brf.signals.pipes.label"),
      value: t("brf.signals.pipes.done", { year: f.pipesReplacedYear }),
      verdict: t("brf.signals.pipes.doneVerdict"),
      summary: t("brf.signals.pipes.doneSummary", { year: f.pipesReplacedYear }),
      tone: "good",
      meaning: t("brf.signals.pipes.doneMeaning"),
      benchmark: null,
    });
  } else if (apartment.buildingYear !== null && thisYear - apartment.buildingYear >= 45) {
    signals.push({
      id: "pipes",
      label: t("brf.signals.pipes.label"),
      value: t("brf.signals.pipes.unknown"),
      verdict: t("brf.signals.pipes.unknownVerdict"),
      summary: t("brf.signals.pipes.unknownSummary", { year: apartment.buildingYear }),
      tone: "watch",
      meaning: t("brf.signals.pipes.unknownMeaning", { year: apartment.buildingYear }),
      benchmark: null,
    });
  }

  if (f.plannedRenovations !== null) {
    signals.push({
      id: "plannedRenovations",
      label: t("brf.signals.plannedRenovations.label"),
      value: t("brf.signals.plannedRenovations.value"),
      verdict: t("brf.signals.plannedRenovations.verdict"),
      summary: t("brf.signals.plannedRenovations.summary"),
      tone: "watch",
      // what the reviewer wrote, as written
      meaning: f.plannedRenovations,
      benchmark: null,
    });
  }

  if (f.feeChangePct !== null && f.feeChangePct !== 0) {
    const direction = f.feeChangePct > 0 ? "up" : "down";
    const value = `${f.feeChangePct > 0 ? "+" : "−"}${fx.percent(Math.abs(f.feeChangePct))}`;
    const size = fx.percent(Math.abs(f.feeChangePct));
    const from = effectiveLabel(f.feeChangeEffective, kit);
    if (feeChangeAlreadyApplied(f, now)) {
      signals.push({
        id: "feeChange",
        label: t("brf.signals.feeChange.appliedLabel"),
        value,
        verdict: direction === "up" ? t("brf.signals.feeChange.appliedUp") : t("brf.signals.feeChange.appliedDown"),
        summary: t("brf.signals.feeChange.appliedSummary", { direction, value: size, from }),
        tone: "neutral",
        meaning: t("brf.signals.feeChange.appliedMeaning", { direction, value: size, from }),
        benchmark: null,
      });
    } else {
      signals.push({
        id: "feeChange",
        label: t("brf.signals.feeChange.decidedLabel"),
        value,
        verdict: direction === "up" ? t("brf.signals.feeChange.decidedUp") : t("brf.signals.feeChange.decidedDown"),
        summary: from
          ? t("brf.signals.feeChange.decidedSummaryFrom", { direction, value: size, from })
          : t("brf.signals.feeChange.decidedSummary", { direction, value: size }),
        tone: direction === "up" ? "watch" : "good",
        meaning: from
          ? t("brf.signals.feeChange.decidedMeaningFrom", { direction, value: size, from })
          : t("brf.signals.feeChange.decidedMeaning", { direction, value: size }),
        benchmark: null,
      });
    }
  }

  if (f.auditRemark !== null) {
    signals.push(
      f.auditRemark
        ? {
            id: "audit",
            label: t("brf.signals.audit.label"),
            value: t("brf.signals.audit.remark"),
            verdict: t("brf.signals.audit.remarkVerdict"),
            summary: t("brf.signals.audit.remarkSummary"),
            tone: "alert",
            meaning: t("brf.signals.audit.remarkMeaning"),
            benchmark: null,
          }
        : {
            id: "audit",
            label: t("brf.signals.audit.label"),
            value: t("brf.signals.audit.clean"),
            verdict: t("brf.signals.audit.cleanVerdict"),
            summary: t("brf.signals.audit.cleanSummary"),
            tone: "good",
            meaning: t("brf.signals.audit.cleanMeaning"),
            benchmark: null,
          }
    );
  }

  if (f.numberOfApartments !== null) {
    const small = f.numberOfApartments < 10;
    const parts = [t("brf.signals.size.apartments", { count: f.numberOfApartments }) as string];
    if (f.numberOfRentalApartments) parts.push(t("brf.signals.size.rentals", { count: f.numberOfRentalApartments }));
    if (f.numberOfCommercialUnits) parts.push(t("brf.signals.size.commercial", { count: f.numberOfCommercialUnits }));
    signals.push({
      id: "size",
      label: t("brf.signals.size.label"),
      value: parts.join(", "),
      verdict: small ? t("brf.signals.size.smallVerdict") : t("brf.signals.size.verdict"),
      summary: small ? t("brf.signals.size.smallSummary", { count: f.numberOfApartments }) : parts.join(", "),
      tone: small ? "watch" : "neutral",
      meaning: small ? t("brf.signals.size.smallMeaning") : t("brf.signals.size.meaning"),
      benchmark: small ? t("brf.signals.size.smallBenchmark") : null,
    });
  }

  return signals;
}

/* ── What it means for this home ─────────────────────────────────────── */

function impactsForYou(f: BrfFigures, apartment: BrfApartmentContext, debt: Draft | null, now: Date, kit: TextKit, fx: Format): BrfImpact[] {
  const t = kit.t;
  const impacts: BrfImpact[] = [];
  const area = apartment.livingAreaM2 !== null && apartment.livingAreaM2 > 0 ? apartment.livingAreaM2 : null;
  const fee = apartment.monthlyFeeSek !== null && apartment.monthlyFeeSek > 0 ? apartment.monthlyFeeSek : null;

  const debtPerSqm = f.debtPerSqmBr ?? f.debtPerSqmTotal;
  if (debtPerSqm !== null && area !== null) {
    impacts.push({
      id: "shareOfDebt",
      label: t("brf.impacts.shareOfDebt.label"),
      value: t("brf.impacts.shareOfDebt.value", { amount: fx.roughKr(debtPerSqm * area) }),
      explanation: t("brf.impacts.shareOfDebt.explanation", { area: fx.grouped(area), amount: fx.roughKr(debtPerSqm * area) }),
      tone: debt?.tone ?? "neutral",
    });
  }

  if (f.interestSensitivityPct !== null && fee !== null) {
    const increase = (fee * f.interestSensitivityPct) / 100;
    impacts.push({
      id: "rateRise",
      label: t("brf.impacts.rateRise.label"),
      value: t("brf.impacts.rateRise.value", { amount: fx.signedKr(increase) }),
      explanation: t("brf.impacts.rateRise.explanation", {
        sensitivity: fx.percent(f.interestSensitivityPct),
        increase: fx.kr(increase),
        fee: fx.kr(fee),
        newFee: fx.kr(fee + increase),
      }),
      tone: f.interestSensitivityPct >= 10 ? "watch" : "neutral",
    });
  }

  if (f.feeChangePct !== null && f.feeChangePct !== 0 && fee !== null && !feeChangeAlreadyApplied(f, now)) {
    const change = (fee * f.feeChangePct) / 100;
    const from = effectiveLabel(f.feeChangeEffective, kit);
    impacts.push({
      id: "feeChange",
      label: t("brf.impacts.feeChange.label"),
      value: t("brf.impacts.feeChange.value", { amount: fx.signedKr(change) }),
      explanation: t("brf.impacts.feeChange.explanation", {
        value: `${f.feeChangePct > 0 ? "+" : "−"}${fx.percent(Math.abs(f.feeChangePct))}`,
        from: from ? t("brf.impacts.feeChange.from", { date: from }) : "",
        newFee: fx.kr(fee + change),
        fee: fx.kr(fee),
      }),
      tone: change > 0 ? "watch" : "good",
    });
  }

  if (f.annualFeePerSqm !== null && fee !== null && area !== null) {
    const own = (fee * 12) / area;
    const higher = own > f.annualFeePerSqm * 1.2;
    impacts.push({
      id: "ownFeeLevel",
      label: t("brf.impacts.ownFeeLevel.label"),
      value: t("brf.impacts.ownFeeLevel.value", { amount: fx.krPerSqm(own) }),
      explanation:
        t("brf.impacts.ownFeeLevel.explanation", { own: fx.krPerSqm(own), average: fx.krPerSqm(f.annualFeePerSqm) }) +
        (higher ? ` ${t("brf.impacts.ownFeeLevel.higher")}` : ""),
      tone: higher ? "watch" : "neutral",
    });
  }

  return impacts;
}

/* ── Questions ───────────────────────────────────────────────────────── */

function questionsFor(f: BrfFigures, signals: BrfSignal[], missing: string[], thisYear: number, kit: TextKit, fx: Format): string[] {
  const t = kit.t;
  const questions: string[] = [];
  const toneOf = (id: string) => signals.find((s) => s.id === id)?.tone;

  if (f.fiscalYear !== null && f.fiscalYear < thisYear - 1) {
    questions.push(t("brf.questions.newerReport", { year: f.fiscalYear }));
  }
  if (toneOf("pipes") === "watch") {
    questions.push(t("brf.questions.pipes"));
  }
  if (f.landTenure === "leasehold") {
    questions.push(t("brf.questions.leasehold"));
  }
  if (f.hasMaintenancePlan !== true) {
    questions.push(t("brf.questions.maintenancePlan"));
  }
  if (toneOf("savings") === "watch" || toneOf("savings") === "alert") {
    questions.push(t("brf.questions.savings"));
  }
  if (
    toneOf("interestSensitivity") === "watch" ||
    toneOf("interestSensitivity") === "alert" ||
    toneOf("renegotiation") === "watch"
  ) {
    questions.push(t("brf.questions.loans"));
  }
  if (f.isGenuine === null) {
    questions.push(t("brf.questions.genuine"));
  }
  if (f.auditRemark === true) {
    questions.push(t("brf.questions.audit"));
  }
  if (missing.length > 0) {
    questions.push(t("brf.questions.missing", { list: missing.join(", ") }));
  }
  questions.push(t("brf.questions.feeIncrease"));
  void fx;
  return questions;
}

/* ── Entry point ─────────────────────────────────────────────────────── */

/** Key figures read "Verdict (value)"; a qualitative signal states its own summary. */
function withSummary(signal: Draft): BrfSignal {
  return { ...signal, summary: signal.summary ?? `${signal.verdict} (${signal.value})` };
}

export function interpretBrf(f: BrfFigures, apartment: BrfApartmentContext, kit: TextKit, now: Date = new Date()): BrfReading {
  const fx = formatters(kit);
  const thisYear = now.getFullYear();
  const debt = debtSignal(f, apartment, thisYear, kit, fx);
  const keyFigures = [
    debt,
    savingsSignal(f, kit, fx),
    interestSensitivitySignal(f, kit, fx),
    feeSignal(f, kit, fx),
    energySignal(f, kit, fx),
    feeShareSignal(f, kit, fx),
    equitySignal(f, kit, fx),
  ]
    .filter((s): s is Draft => s !== null)
    .map(withSummary);
  const loans = loanSignals(f, kit, fx).map(withSummary);
  const association = associationSignals(f, apartment, thisYear, now, kit, fx).map(withSummary);
  const all = [...keyFigures, ...loans, ...association];

  // debtPerSqmTotal is not missing when the per-bostadsrätt figure is there (and vice versa) — one debt figure is enough to read the debt.
  const missingKeyFigures = MANDATORY_KEY_FIGURES.filter((key) => {
    if (key === "debtPerSqmTotal" || key === "debtPerSqmBr") return f.debtPerSqmBr === null && f.debtPerSqmTotal === null && key === "debtPerSqmBr";
    return f[key] === null;
  }).map((key) => kit.t(`brf.keyFigureNames.${key}`) as string);

  const line = (s: BrfSignal) => s.summary;

  return {
    fiscalYear: f.fiscalYear,
    keyFigures,
    loans,
    association,
    forYou: impactsForYou(f, apartment, debt, now, kit, fx),
    strengths: all.filter((s) => s.tone === "good").map(line),
    concerns: all.filter((s) => s.tone === "watch" || s.tone === "alert").map(line),
    missingKeyFigures,
    questions: questionsFor(f, all, missingKeyFigures, thisYear, kit, fx),
    expertComment: f.expertComment,
  };
}
