import type { BrfFigures } from "./figures";
import { MANDATORY_KEY_FIGURES } from "./figures";

/**
 * Turns the figures a Köpanalys reviewer recorded from an annual report
 * (figures.ts) into the BRF analysis the buyer reads: each key figure in plain
 * Swedish, what it means, how it compares with what is usually considered low
 * or high, and what it means in kronor for this particular home.
 *
 * The benchmarks are the levels Swedish banks and the large housing
 * organisations publish for buyers, and the national averages come from Nabo's
 * analysis of 2 250 associations' annual reports for 2023 (the first year the
 * key figures were mandatory). Sources and the date they were checked are in
 * BRF_BENCHMARK_SOURCES; docs/48 has the full table. A tone is a reading of one
 * figure against those levels — there is no overall score or verdict.
 *
 * Pure and dependency-free (the verify scripts run it with tsx, and the review
 * console runs it in the browser for its live preview).
 */

export type Tone = "good" | "neutral" | "watch" | "alert";

export interface BrfSignal {
  id: string;
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

export const BRF_BENCHMARK_SOURCES =
  "Riktvärden: SBAB, HSB och Handelsbanken. Snittvärden: Nabos analys av 2 250 föreningars årsredovisningar för 2023. " +
  "Definitioner: Bokföringsnämnden (BFNAR 2023:1). Uppgifterna kontrollerades i oktober 2026.";

const KEY_FIGURE_LABELS: Record<string, string> = {
  annualFeePerSqm: "årsavgift per kvm",
  debtPerSqmBr: "skuldsättning per kvm upplåten med bostadsrätt",
  debtPerSqmTotal: "skuldsättning per kvm",
  savingsPerSqm: "sparande per kvm",
  interestSensitivityPct: "räntekänslighet",
  energyCostPerSqm: "energikostnad per kvm",
  feeShareOfRevenuePct: "årsavgifternas andel av rörelseintäkterna",
};

/* ── Formatting (kept local so this module has no runtime imports) ───── */

const NBSP = " ";

function grouped(value: number, decimals = 0): string {
  return new Intl.NumberFormat("sv-SE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

function kr(value: number): string {
  return `${grouped(Math.round(value))}${NBSP}kr`;
}

function krPerSqm(value: number): string {
  return `${grouped(Math.round(value))}${NBSP}kr/kvm`;
}

function percent(value: number): string {
  const decimals = Number.isInteger(value) ? 0 : 1;
  return `${grouped(value, decimals)}${NBSP}%`;
}

function signedKr(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${grouped(Math.abs(rounded))}${NBSP}kr`;
}

/** Rounds a large amount for prose ("cirka 520 000 kr") — never more precise than the inputs. */
function roughKr(value: number): string {
  const magnitude = Math.abs(value) >= 100_000 ? 10_000 : Math.abs(value) >= 10_000 ? 1_000 : 100;
  return kr(Math.round(value / magnitude) * magnitude);
}

/* ── Key figures ─────────────────────────────────────────────────────── */

function debtSignal(f: BrfFigures, apartment: BrfApartmentContext, thisYear: number): Draft | null {
  const value = f.debtPerSqmBr ?? f.debtPerSqmTotal;
  if (value === null) return null;
  const perBr = f.debtPerSqmBr !== null;
  const [tone, verdict]: [Tone, string] =
    value < 5000
      ? ["good", "Låg skuldsättning"]
      : value < 10000
        ? ["neutral", "Normal skuldsättning"]
        : value < 15000
          ? ["watch", "Hög skuldsättning"]
          : ["alert", "Mycket hög skuldsättning"];
  const newBuilding = apartment.buildingYear !== null && thisYear - apartment.buildingYear <= 15;
  return {
    id: "debt",
    label: perBr ? "Skuldsättning per kvm" : "Skuldsättning per kvm (total yta)",
    value: krPerSqm(value),
    verdict,
    tone,
    meaning:
      "Föreningens lån fördelade per kvadratmeter. Lånen betalas i praktiken av medlemmarna genom avgiften, så ju högre skuld, desto mer påverkas avgiften av räntan." +
      (newBuilding
        ? " I nyare föreningar är en högre skuld vanlig eftersom fastigheten nyss har finansierats — läs den tillsammans med sparandet och avgiften."
        : ""),
    benchmark:
      "Under 5 000 kr/kvm brukar räknas som lågt, över 10 000 kr/kvm som högt och över 15 000 kr/kvm som mycket högt. Snittet var 7 117 kr/kvm år 2023.",
  };
}

function savingsSignal(f: BrfFigures): Draft | null {
  const value = f.savingsPerSqm;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value < 0
      ? ["alert", "Negativt sparande"]
      : value < 130
        ? ["watch", "Lågt sparande"]
        : value < 200
          ? ["neutral", "Måttligt sparande"]
          : ["good", "Gott sparande"];
  return {
    id: "savings",
    label: "Sparande per kvm",
    value: krPerSqm(value),
    verdict,
    tone,
    meaning:
      "Hur mycket pengar föreningen får över per kvadratmeter och år till underhåll och amortering — årets resultat justerat för avskrivningar och planerat underhåll. " +
      "Ett lågt sparande kan betyda att framtida underhåll behöver betalas med nya lån eller höjd avgift.",
    benchmark:
      "Över 200 kr/kvm brukar räknas som ett gott sparande och under 120–130 kr/kvm som lågt. Snittet var 123 kr/kvm år 2023, och knappt var femte förening hade negativt sparande.",
  };
}

function interestSensitivitySignal(f: BrfFigures): Draft | null {
  const value = f.interestSensitivityPct;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value < 5
      ? ["good", "Låg räntekänslighet"]
      : value < 10
        ? ["neutral", "Normal räntekänslighet"]
        : value < 15
          ? ["watch", "Hög räntekänslighet"]
          : ["alert", "Mycket hög räntekänslighet"];
  return {
    id: "interestSensitivity",
    label: "Räntekänslighet",
    value: percent(value),
    verdict,
    tone,
    meaning: `Om räntan på föreningens lån stiger med en procentenhet kan årsavgifterna behöva höjas med omkring ${percent(value)}.`,
    benchmark: "Under 5–6 % brukar räknas som lågt och över 10 % som högt. Snittet var omkring 10 % år 2023.",
  };
}

function feeSignal(f: BrfFigures): Draft | null {
  const value = f.annualFeePerSqm;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value < 500
      ? ["neutral", "Låg avgiftsnivå"]
      : value < 850
        ? ["good", "Normal avgiftsnivå"]
        : value < 1000
          ? ["watch", "Hög avgiftsnivå"]
          : ["alert", "Mycket hög avgiftsnivå"];
  return {
    id: "fee",
    label: "Årsavgift per kvm",
    value: krPerSqm(value),
    verdict,
    tone,
    meaning:
      "Medlemmarnas sammanlagda årsavgifter per kvadratmeter bostadsrättsyta. Nivån beror på vad som ingår i avgiften, till exempel värme, vatten, el och bredband." +
      (value < 500
        ? " En låg avgift är bra för plånboken men kan också betyda att föreningen sparar för lite — jämför med sparandet."
        : ""),
    benchmark: "Vanligt är 500–850 kr/kvm och år; över 1 000 kr/kvm brukar räknas som högt. Snittet var 690 kr/kvm år 2023.",
  };
}

function energySignal(f: BrfFigures): Draft | null {
  const value = f.energyCostPerSqm;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value < 150
      ? ["good", "Låg energikostnad"]
      : value < 250
        ? ["neutral", "Normal energikostnad"]
        : value < 300
          ? ["watch", "Hög energikostnad"]
          : ["alert", "Mycket hög energikostnad"];
  return {
    id: "energy",
    label: "Energikostnad per kvm",
    value: krPerSqm(value),
    verdict,
    tone,
    meaning: "Föreningens kostnader för värme, el och vatten per kvadratmeter. Höga energikostnader slår igenom på avgiften när energipriserna stiger.",
    benchmark: "Omkring 200 kr/kvm är normalt i ett flerbostadshus; över 250 kr/kvm brukar räknas som högt. Snittet var 203 kr/kvm år 2023.",
  };
}

function feeShareSignal(f: BrfFigures): Draft | null {
  const value = f.feeShareOfRevenuePct;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value >= 85
      ? ["neutral", "Finansieras främst av avgifterna"]
      : value >= 60
        ? ["neutral", "Har även andra intäkter"]
        : ["watch", "Stort beroende av andra intäkter"];
  return {
    id: "feeShare",
    label: "Avgifternas andel av intäkterna",
    value: percent(value),
    verdict,
    tone,
    meaning:
      "Hur stor del av föreningens intäkter som kommer från medlemmarnas årsavgifter. Resten kommer från till exempel hyror för lokaler, hyreslägenheter och parkering — " +
      "sådana intäkter håller nere avgiften men kan minska om en hyresgäst flyttar.",
    benchmark: "I snitt kom 77 % av föreningarnas intäkter från årsavgifter år 2023.",
  };
}

function equitySignal(f: BrfFigures): Draft | null {
  const value = f.equityRatioPct;
  if (value === null) return null;
  const [tone, verdict]: [Tone, string] =
    value < 10 ? ["watch", "Låg soliditet"] : value < 50 ? ["neutral", "Måttlig soliditet"] : ["neutral", "Hög soliditet"];
  return {
    id: "equity",
    label: "Soliditet",
    value: percent(value),
    verdict,
    tone,
    meaning:
      "Hur stor del av föreningens tillgångar som finansieras med eget kapital. Soliditeten säger mindre om en bostadsrättsförening än om ett företag, eftersom den påverkas av hur fastigheten köptes och skrivs av — läs den tillsammans med skuldsättning och sparande.",
    benchmark: null,
  };
}

/* ── Loans ───────────────────────────────────────────────────────────── */

function loanSignals(f: BrfFigures): Draft[] {
  const signals: Draft[] = [];
  if (f.interestBearingDebtSek !== null) {
    signals.push({
      id: "totalDebt",
      label: "Föreningens lån",
      value: kr(f.interestBearingDebtSek),
      verdict: "Räntebärande skulder",
      tone: "neutral",
      meaning: "Föreningens samlade lån hos banker och andra kreditinstitut vid bokslutet.",
      benchmark: null,
    });
  }
  if (f.averageInterestRatePct !== null) {
    signals.push({
      id: "averageRate",
      label: "Genomsnittlig ränta",
      value: percent(f.averageInterestRatePct),
      verdict: "Snittränta på lånen",
      tone: "neutral",
      meaning: "Den genomsnittliga räntan på föreningens lån vid bokslutet. När lån med lägre ränta omförhandlas till en högre ränta ökar föreningens kostnader.",
      benchmark: null,
    });
  }
  if (f.debtRenegotiatedWithin12mPct !== null) {
    const value = f.debtRenegotiatedWithin12mPct;
    signals.push({
      id: "renegotiation",
      label: "Lån som omförhandlas inom ett år",
      value: percent(value),
      verdict: value >= 50 ? "Stor del omförhandlas snart" : "Andel med kort bindning",
      summary: `${percent(value)} av lånen omförhandlas inom ett år`,
      tone: value >= 50 ? "watch" : "neutral",
      meaning:
        "Den del av lånen vars ränta sätts om eller som förfaller inom tolv månader. Ju större andel, desto snabbare slår en ändrad ränta igenom på föreningens kostnader och avgiften.",
      benchmark: null,
    });
  }
  return signals;
}

/* ── The association and what is planned ─────────────────────────────── */

const MONTHS_SV = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];

/**
 * When a decided fee change applies: "2025-01-01", "20250101" or
 * "1 januari 2027". Anything else is read as upcoming, as the reviewer wrote it.
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

/** A change an older annual report announced that has already taken effect — most likely already in the listing's fee. */
function feeChangeAlreadyApplied(f: BrfFigures, now: Date): boolean {
  const date = parseEffectiveDate(f.feeChangeEffective);
  return date !== null && date.getTime() <= now.getTime();
}

function associationSignals(f: BrfFigures, apartment: BrfApartmentContext, thisYear: number, now: Date): Draft[] {
  const signals: Draft[] = [];

  if (f.isGenuine !== null) {
    signals.push(
      f.isGenuine
        ? {
            id: "genuine",
            label: "Äkta förening",
            value: "Ja",
            verdict: "Privatbostadsföretag",
            summary: "Äkta förening (privatbostadsföretag)",
            tone: "good",
            meaning: "Föreningen är ett privatbostadsföretag (en äkta förening). Vinsten vid en framtida försäljning beskattas med 22 %.",
            benchmark: null,
          }
        : {
            id: "genuine",
            label: "Äkta förening",
            value: "Nej",
            verdict: "Oäkta förening",
            summary: "Oäkta förening — högre skatt vid försäljning",
            tone: "alert",
            meaning:
              "Föreningen är inte ett privatbostadsföretag (en oäkta förening). Vinsten vid en framtida försäljning beskattas då med 25 % i stället för 22 %, och möjligheten till uppskov med skatten är begränsad.",
            benchmark: null,
          }
    );
  }

  if (f.landTenure === "owned") {
    signals.push({
      id: "land",
      label: "Marken",
      value: "Äganderätt",
      verdict: "Föreningen äger marken",
      summary: "Föreningen äger marken",
      tone: "good",
      meaning: "Föreningen äger marken fastigheten står på och betalar ingen tomträttsavgäld.",
      benchmark: null,
    });
  } else if (f.landTenure === "leasehold") {
    const year = f.leaseholdRenegotiationYear;
    const soon = year !== null && year - thisYear <= 5;
    signals.push({
      id: "land",
      label: "Marken",
      value: "Tomträtt",
      verdict: year !== null ? `Avgälden omförhandlas ${year}` : "Föreningen hyr marken",
      summary: year !== null ? `Tomträtt — avgälden omförhandlas ${year}` : "Tomträtt — föreningen hyr marken",
      tone: soon ? "alert" : "watch",
      meaning:
        "Föreningen äger inte marken utan betalar tomträttsavgäld till kommunen. Avgälden omförhandlas med jämna mellanrum och kan då höjas kraftigt, vilket slår igenom på avgiften." +
        (year !== null ? ` Nästa omförhandling sker ${year}.` : ""),
      benchmark: null,
    });
  }

  if (f.hasMaintenancePlan !== null) {
    signals.push(
      f.hasMaintenancePlan
        ? {
            id: "maintenancePlan",
            label: "Underhållsplan",
            value: "Finns",
            verdict: "Aktuell underhållsplan",
            summary: "Aktuell underhållsplan finns",
            tone: "good",
            meaning: "Föreningen har en aktuell plan för när de större åtgärderna i fastigheten behöver göras och vad de beräknas kosta.",
            benchmark: null,
          }
        : {
            id: "maintenancePlan",
            label: "Underhållsplan",
            value: "Saknas",
            verdict: "Ingen aktuell underhållsplan",
            summary: "Ingen aktuell underhållsplan",
            tone: "watch",
            meaning: "Föreningen anger att den inte har en aktuell underhållsplan, så det är svårare att veta när större åtgärder kommer och vad de kostar.",
            benchmark: null,
          }
    );
  }

  if (f.pipesPlannedYear !== null) {
    signals.push({
      id: "pipes",
      label: "Stambyte",
      value: `Planerat ${f.pipesPlannedYear}`,
      verdict: "Stambyte planerat",
      summary: `Stambyte planerat ${f.pipesPlannedYear}`,
      tone: "watch",
      meaning:
        "Ett stambyte är en av de största åtgärderna i ett flerbostadshus. Det kan innebära höjd avgift eller nya lån, och att badrum och kök inte går att använda under en period.",
      benchmark: null,
    });
  } else if (f.pipesReplacedYear !== null) {
    signals.push({
      id: "pipes",
      label: "Stambyte",
      value: `Genomfört ${f.pipesReplacedYear}`,
      verdict: "Stambyte gjort",
      summary: `Stambyte genomfört ${f.pipesReplacedYear}`,
      tone: "good",
      meaning: "Rören i fastigheten är bytta, vilket är en av de största och dyraste åtgärderna i ett flerbostadshus.",
      benchmark: null,
    });
  } else if (apartment.buildingYear !== null && thisYear - apartment.buildingYear >= 45) {
    signals.push({
      id: "pipes",
      label: "Stambyte",
      value: "Framgår inte",
      verdict: "Inget stambyte angivet",
      summary: `Inget stambyte angivet i ett hus från ${apartment.buildingYear}`,
      tone: "watch",
      meaning: `Huset är från ${apartment.buildingYear}. Rör brukar behöva bytas efter ungefär 50 år, och årsredovisningen visar inte att stambyte är gjort eller planerat.`,
      benchmark: null,
    });
  }

  if (f.plannedRenovations !== null) {
    signals.push({
      id: "plannedRenovations",
      label: "Planerat underhåll",
      value: "Se beskrivning",
      verdict: "Större åtgärder planeras",
      summary: "Större underhållsåtgärder planeras",
      tone: "watch",
      meaning: f.plannedRenovations,
      benchmark: null,
    });
  }

  if (f.feeChangePct !== null && f.feeChangePct !== 0 && feeChangeAlreadyApplied(f, now)) {
    const increase = f.feeChangePct > 0;
    signals.push({
      id: "feeChange",
      label: "Genomförd avgiftsförändring",
      value: `${increase ? "+" : "−"}${percent(Math.abs(f.feeChangePct))}`,
      verdict: increase ? "Avgiften har höjts" : "Avgiften har sänkts",
      summary: `Avgiften ${increase ? "höjdes" : "sänktes"} med ${percent(Math.abs(f.feeChangePct))} från ${f.feeChangeEffective}`,
      tone: "neutral",
      meaning:
        `Enligt årsredovisningen ${increase ? "höjdes" : "sänktes"} avgiften med ${percent(Math.abs(f.feeChangePct))} från ${f.feeChangeEffective}. ` +
        "Förändringen ingår troligen redan i avgiften i annonsen.",
      benchmark: null,
    });
  } else if (f.feeChangePct !== null && f.feeChangePct !== 0) {
    const increase = f.feeChangePct > 0;
    signals.push({
      id: "feeChange",
      label: "Beslutad avgiftsförändring",
      value: `${increase ? "+" : "−"}${percent(Math.abs(f.feeChangePct))}`,
      verdict: increase ? "Avgiften höjs" : "Avgiften sänks",
      summary: `Beslutad avgifts${increase ? "höjning" : "sänkning"} på ${percent(Math.abs(f.feeChangePct))}${f.feeChangeEffective ? ` från ${f.feeChangeEffective}` : ""}`,
      tone: increase ? "watch" : "good",
      meaning:
        `Föreningen har beslutat att ${increase ? "höja" : "sänka"} avgiften med ${percent(Math.abs(f.feeChangePct))}` +
        (f.feeChangeEffective ? ` från ${f.feeChangeEffective}.` : "."),
      benchmark: null,
    });
  }

  if (f.auditRemark !== null) {
    signals.push(
      f.auditRemark
        ? {
            id: "audit",
            label: "Revisionsberättelsen",
            value: "Anmärkning",
            verdict: "Revisorn har anmärkt",
            summary: "Anmärkning i revisionsberättelsen",
            tone: "alert",
            meaning: "Revisorn har lämnat en anmärkning eller avstyrkt något i revisionsberättelsen. Det är ovanligt och betyder att något i förvaltningen eller redovisningen behöver förklaras.",
            benchmark: null,
          }
        : {
            id: "audit",
            label: "Revisionsberättelsen",
            value: "Utan anmärkning",
            verdict: "Ren revisionsberättelse",
            summary: "Ren revisionsberättelse",
            tone: "good",
            meaning: "Revisorn har granskat räkenskaperna och styrelsens förvaltning utan att lämna någon anmärkning.",
            benchmark: null,
          }
    );
  }

  if (f.numberOfApartments !== null) {
    const small = f.numberOfApartments < 10;
    const parts = [`${f.numberOfApartments} bostadsrätter`];
    if (f.numberOfRentalApartments) parts.push(`${f.numberOfRentalApartments} hyresrätter`);
    if (f.numberOfCommercialUnits) parts.push(`${f.numberOfCommercialUnits} lokaler`);
    signals.push({
      id: "size",
      label: "Föreningens storlek",
      value: parts.join(", "),
      verdict: small ? "Liten förening" : "Föreningens storlek",
      summary: small ? `Liten förening (${f.numberOfApartments} bostadsrätter)` : parts.join(", "),
      tone: small ? "watch" : "neutral",
      meaning: small
        ? "I en liten förening delas kostnaderna för underhåll och oväntade utgifter på färre hushåll, så en enskild större kostnad märks mer på avgiften."
        : "Antalet lägenheter och lokaler i föreningen. Ju fler hushåll, desto fler delar på kostnaderna för underhåll och oväntade utgifter.",
      benchmark: small ? "Föreningar med färre än tio lägenheter brukar räknas som små." : null,
    });
  }

  return signals;
}

/* ── What it means for this home ─────────────────────────────────────── */

function impactsForYou(f: BrfFigures, apartment: BrfApartmentContext, debt: Draft | null, now: Date): BrfImpact[] {
  const impacts: BrfImpact[] = [];
  const area = apartment.livingAreaM2 !== null && apartment.livingAreaM2 > 0 ? apartment.livingAreaM2 : null;
  const fee = apartment.monthlyFeeSek !== null && apartment.monthlyFeeSek > 0 ? apartment.monthlyFeeSek : null;

  const debtPerSqm = f.debtPerSqmBr ?? f.debtPerSqmTotal;
  if (debtPerSqm !== null && area !== null) {
    impacts.push({
      id: "shareOfDebt",
      label: "Din del av föreningens lån",
      value: `cirka ${roughKr(debtPerSqm * area)}`,
      explanation:
        `Föreningens lån betalas av medlemmarna genom avgiften. Räknat på lägenhetens boarea (${grouped(area)} kvm) motsvarar din del ungefär ${roughKr(debtPerSqm * area)} — ` +
        "utöver ditt eget bolån. Den exakta andelen beror på lägenhetens andelstal.",
      tone: debt?.tone ?? "neutral",
    });
  }

  if (f.interestSensitivityPct !== null && fee !== null) {
    const increase = (fee * f.interestSensitivityPct) / 100;
    impacts.push({
      id: "rateRise",
      label: "Om räntan stiger 1 procentenhet",
      value: `${signedKr(increase)}/mån`,
      explanation:
        `Med föreningens räntekänslighet på ${percent(f.interestSensitivityPct)} kan avgiften behöva höjas med omkring ${kr(increase)} i månaden ` +
        `(från ${kr(fee)} till cirka ${kr(fee + increase)}) om räntan på föreningens lån stiger med en procentenhet.`,
      tone: f.interestSensitivityPct >= 10 ? "watch" : "neutral",
    });
  }

  if (f.feeChangePct !== null && f.feeChangePct !== 0 && fee !== null && !feeChangeAlreadyApplied(f, now)) {
    const change = (fee * f.feeChangePct) / 100;
    impacts.push({
      id: "feeChange",
      label: "Beslutad avgiftsförändring",
      value: `${signedKr(change)}/mån`,
      explanation:
        `Den beslutade förändringen på ${f.feeChangePct > 0 ? "+" : "−"}${percent(Math.abs(f.feeChangePct))}${f.feeChangeEffective ? ` från ${f.feeChangeEffective}` : ""} ` +
        `ger en avgift på cirka ${kr(fee + change)} i månaden, jämfört med ${kr(fee)} i annonsen.`,
      tone: change > 0 ? "watch" : "good",
    });
  }

  if (f.annualFeePerSqm !== null && fee !== null && area !== null) {
    const own = (fee * 12) / area;
    const higher = own > f.annualFeePerSqm * 1.2;
    impacts.push({
      id: "ownFeeLevel",
      label: "Lägenhetens avgift per kvm",
      value: `${krPerSqm(own)} och år`,
      explanation:
        `Lägenhetens avgift motsvarar ${krPerSqm(own)} och år, jämfört med föreningens genomsnitt på ${krPerSqm(f.annualFeePerSqm)}.` +
        (higher
          ? " Det är tydligt högre än snittet, vilket kan bero på lägenhetens andelstal eller på att avgiften inkluderar mer, till exempel el eller bredband."
          : ""),
      tone: higher ? "watch" : "neutral",
    });
  }

  return impacts;
}

/* ── Questions ───────────────────────────────────────────────────────── */

function questionsFor(f: BrfFigures, signals: BrfSignal[], missing: string[], thisYear: number): string[] {
  const questions: string[] = [];
  const toneOf = (id: string) => signals.find((s) => s.id === id)?.tone;

  if (f.fiscalYear !== null && f.fiscalYear < thisYear - 1) {
    questions.push(`Finns det en nyare årsredovisning än den för ${f.fiscalYear}?`);
  }
  if (toneOf("pipes") === "watch") {
    questions.push("När är stambytet planerat, och hur ska det finansieras — med sparade medel, nya lån eller höjd avgift?");
  }
  if (f.landTenure === "leasehold") {
    questions.push("När omförhandlas tomträttsavgälden nästa gång, och vad räknar föreningen med att den hamnar på?");
  }
  if (f.hasMaintenancePlan !== true) {
    questions.push("Finns det en aktuell underhållsplan, och vilka större åtgärder planeras de närmaste fem åren?");
  }
  if (toneOf("savings") === "watch" || toneOf("savings") === "alert") {
    questions.push("Hur ska föreningen betala framtida underhåll när sparandet är lågt?");
  }
  if (
    toneOf("interestSensitivity") === "watch" ||
    toneOf("interestSensitivity") === "alert" ||
    toneOf("renegotiation") === "watch"
  ) {
    questions.push("Hur stor del av föreningens lån ska omförhandlas det närmaste året, och vilken ränta räknar styrelsen med?");
  }
  if (f.isGenuine === null) {
    questions.push("Är föreningen ett privatbostadsföretag (en äkta förening)?");
  }
  if (f.auditRemark === true) {
    questions.push("Vad gällde revisorns anmärkning, och är frågan åtgärdad?");
  }
  if (missing.length > 0) {
    questions.push(`Årsredovisningen anger inte ${missing.join(", ")} — kan föreningen ta fram uppgifterna?`);
  }
  questions.push("Finns det beslut eller planer på avgiftshöjningar som inte syns i årsredovisningen?");
  return questions;
}

/* ── Entry point ─────────────────────────────────────────────────────── */

type Draft = Omit<BrfSignal, "summary"> & { summary?: string };

/** Key figures read "Verdict (value)"; a qualitative signal states its own summary. */
function withSummary(signal: Draft): BrfSignal {
  return { ...signal, summary: signal.summary ?? `${signal.verdict} (${signal.value})` };
}

export function interpretBrf(f: BrfFigures, apartment: BrfApartmentContext, now: Date = new Date()): BrfReading {
  const thisYear = now.getFullYear();
  const debt = debtSignal(f, apartment, thisYear);
  const keyFigures = [
    debt,
    savingsSignal(f),
    interestSensitivitySignal(f),
    feeSignal(f),
    energySignal(f),
    feeShareSignal(f),
    equitySignal(f),
  ]
    .filter((s): s is Draft => s !== null)
    .map(withSummary);
  const loans = loanSignals(f).map(withSummary);
  const association = associationSignals(f, apartment, thisYear, now).map(withSummary);
  const all = [...keyFigures, ...loans, ...association];

  // debtPerSqmTotal is not missing when the per-bostadsrätt figure is there (and vice versa) — one debt figure is enough to read the debt.
  const missingKeyFigures = MANDATORY_KEY_FIGURES.filter((key) => {
    if (key === "debtPerSqmTotal" || key === "debtPerSqmBr") return f.debtPerSqmBr === null && f.debtPerSqmTotal === null && key === "debtPerSqmBr";
    return f[key] === null;
  }).map((key) => KEY_FIGURE_LABELS[key]);

  const line = (s: BrfSignal) => s.summary;

  return {
    fiscalYear: f.fiscalYear,
    keyFigures,
    loans,
    association,
    forYou: impactsForYou(f, apartment, debt, now),
    strengths: all.filter((s) => s.tone === "good").map(line),
    concerns: all.filter((s) => s.tone === "watch" || s.tone === "alert").map(line),
    missingKeyFigures,
    questions: questionsFor(f, all, missingKeyFigures, thisYear),
    expertComment: f.expertComment,
  };
}
