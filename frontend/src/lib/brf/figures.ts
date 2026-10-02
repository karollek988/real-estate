/**
 * What a Köpanalys reviewer records from one housing association's annual
 * report. The BRF analysis a customer sees is built from these figures only
 * (lib/brf/interpret.ts) — never straight from the automatic extraction,
 * which is just a starting point for the reviewer (see lib/brf/reviews.ts and
 * /admin/brf).
 *
 * Every field is optional: null means "not stated in the annual report / not
 * recorded", never zero. The seven key figures are the ones every annual
 * report must state since fiscal year 2023 (ÅRL 6 kap. 3 a §, BFNAR 2023:1),
 * so the reviewer copies them as written in the förvaltningsberättelse.
 *
 * No imports with runtime effect: the verify scripts run this directly with tsx.
 */

export type LandTenure = "owned" | "leasehold";

export interface BrfFigures {
  /** The fiscal year the annual report covers. */
  fiscalYear: number | null;

  // ── The mandatory key figures (förvaltningsberättelsen / flerårsöversikten) ──
  /** Årsavgift per kvm upplåten med bostadsrätt, kr/kvm och år. */
  annualFeePerSqm: number | null;
  /** Skuldsättning per kvm upplåten med bostadsrätt, kr/kvm. */
  debtPerSqmBr: number | null;
  /** Skuldsättning per kvm (bostadsrätt + hyresrätt), kr/kvm. */
  debtPerSqmTotal: number | null;
  /** Sparande per kvm, kr/kvm och år. */
  savingsPerSqm: number | null;
  /** Räntekänslighet, %. */
  interestSensitivityPct: number | null;
  /** Energikostnad per kvm, kr/kvm och år. */
  energyCostPerSqm: number | null;
  /** Årsavgifternas andel av totala rörelseintäkter, %. */
  feeShareOfRevenuePct: number | null;
  /** Soliditet, %. */
  equityRatioPct: number | null;

  // ── Loans (notes on liabilities to credit institutions) ──
  /** Räntebärande skulder, kr. */
  interestBearingDebtSek: number | null;
  /** Average interest rate on the association's loans at the balance-sheet date, %. */
  averageInterestRatePct: number | null;
  /** Share of the loans whose rate is reset or that mature within 12 months, %. */
  debtRenegotiatedWithin12mPct: number | null;

  // ── The association ──
  numberOfApartments: number | null;
  numberOfRentalApartments: number | null;
  numberOfCommercialUnits: number | null;
  /** Privatbostadsföretag ("äkta" förening). */
  isGenuine: boolean | null;
  landTenure: LandTenure | null;
  /** The year the leasehold fee (tomträttsavgäld) is next renegotiated. */
  leaseholdRenegotiationYear: number | null;
  /** The association states that it has an up-to-date maintenance plan. */
  hasMaintenancePlan: boolean | null;
  /** The auditor's report contains a remark or does not recommend discharge. */
  auditRemark: boolean | null;

  // ── Maintenance and fees ──
  pipesReplacedYear: number | null;
  pipesPlannedYear: number | null;
  /** Larger planned maintenance, in the reviewer's words (roof, facade, windows, elevators ...). */
  plannedRenovations: string | null;
  /** A decided fee change, % (positive = increase). */
  feeChangePct: number | null;
  /** When the decided fee change applies, e.g. "1 januari 2027". */
  feeChangeEffective: string | null;

  /** The reviewer's own comment, shown to the customer as written. */
  expertComment: string | null;
}

export const EMPTY_BRF_FIGURES: BrfFigures = {
  fiscalYear: null,
  annualFeePerSqm: null,
  debtPerSqmBr: null,
  debtPerSqmTotal: null,
  savingsPerSqm: null,
  interestSensitivityPct: null,
  energyCostPerSqm: null,
  feeShareOfRevenuePct: null,
  equityRatioPct: null,
  interestBearingDebtSek: null,
  averageInterestRatePct: null,
  debtRenegotiatedWithin12mPct: null,
  numberOfApartments: null,
  numberOfRentalApartments: null,
  numberOfCommercialUnits: null,
  isGenuine: null,
  landTenure: null,
  leaseholdRenegotiationYear: null,
  hasMaintenancePlan: null,
  auditRemark: null,
  pipesReplacedYear: null,
  pipesPlannedYear: null,
  plannedRenovations: null,
  feeChangePct: null,
  feeChangeEffective: null,
  expertComment: null,
};

export type BrfFieldKind = "number" | "boolean" | "text" | "longtext" | "landTenure";

export interface BrfFieldSpec {
  key: keyof BrfFigures;
  label: string;
  kind: BrfFieldKind;
  unit?: string;
  /** Where in the annual report the value is found — shown to the reviewer. */
  hint?: string;
  /** Plausible range; a value outside it is rejected as a typing error. */
  min?: number;
  max?: number;
  /** Whole numbers only (years, counts). */
  integer?: boolean;
  maxLength?: number;
}

export interface BrfFieldGroup {
  title: string;
  fields: BrfFieldSpec[];
}

const THIS_YEAR = new Date().getFullYear();

/** The review form, group by group — also the single list of what a valid figure looks like. */
export const BRF_FIELD_GROUPS: BrfFieldGroup[] = [
  {
    title: "Nyckeltal (förvaltningsberättelsen)",
    fields: [
      { key: "fiscalYear", label: "Räkenskapsår", kind: "number", integer: true, min: 2000, max: THIS_YEAR + 1, hint: "Året årsredovisningen avser." },
      { key: "annualFeePerSqm", label: "Årsavgift per kvm upplåten med bostadsrätt", kind: "number", unit: "kr/kvm", min: 0, max: 5000 },
      { key: "debtPerSqmBr", label: "Skuldsättning per kvm upplåten med bostadsrätt", kind: "number", unit: "kr/kvm", min: 0, max: 150000 },
      { key: "debtPerSqmTotal", label: "Skuldsättning per kvm", kind: "number", unit: "kr/kvm", min: 0, max: 150000, hint: "Total yta (bostadsrätt + hyresrätt)." },
      { key: "savingsPerSqm", label: "Sparande per kvm", kind: "number", unit: "kr/kvm", min: -10000, max: 10000 },
      { key: "interestSensitivityPct", label: "Räntekänslighet", kind: "number", unit: "%", min: 0, max: 300 },
      { key: "energyCostPerSqm", label: "Energikostnad per kvm", kind: "number", unit: "kr/kvm", min: 0, max: 3000 },
      { key: "feeShareOfRevenuePct", label: "Årsavgifternas andel av totala rörelseintäkter", kind: "number", unit: "%", min: 0, max: 100 },
      { key: "equityRatioPct", label: "Soliditet", kind: "number", unit: "%", min: -100, max: 100 },
    ],
  },
  {
    title: "Lån (noterna)",
    fields: [
      { key: "interestBearingDebtSek", label: "Räntebärande skulder", kind: "number", unit: "kr", min: 0, max: 50_000_000_000, hint: "Skulder till kreditinstitut, kort- och långfristiga." },
      { key: "averageInterestRatePct", label: "Genomsnittlig ränta", kind: "number", unit: "%", min: 0, max: 25 },
      { key: "debtRenegotiatedWithin12mPct", label: "Andel av lånen som omförhandlas inom 12 månader", kind: "number", unit: "%", min: 0, max: 100 },
    ],
  },
  {
    title: "Föreningen",
    fields: [
      { key: "numberOfApartments", label: "Antal bostadsrätter", kind: "number", integer: true, min: 0, max: 20000 },
      { key: "numberOfRentalApartments", label: "Antal hyresrätter", kind: "number", integer: true, min: 0, max: 20000 },
      { key: "numberOfCommercialUnits", label: "Antal lokaler", kind: "number", integer: true, min: 0, max: 5000 },
      { key: "isGenuine", label: "Äkta förening (privatbostadsföretag)", kind: "boolean" },
      { key: "landTenure", label: "Marken", kind: "landTenure" },
      { key: "leaseholdRenegotiationYear", label: "Tomträttsavgälden omförhandlas år", kind: "number", integer: true, min: 1990, max: THIS_YEAR + 100 },
      { key: "hasMaintenancePlan", label: "Aktuell underhållsplan finns", kind: "boolean" },
      { key: "auditRemark", label: "Anmärkning i revisionsberättelsen", kind: "boolean" },
    ],
  },
  {
    title: "Underhåll och avgifter",
    fields: [
      { key: "pipesReplacedYear", label: "Stambyte genomfört år", kind: "number", integer: true, min: 1900, max: THIS_YEAR + 1 },
      { key: "pipesPlannedYear", label: "Stambyte planerat år", kind: "number", integer: true, min: THIS_YEAR - 1, max: THIS_YEAR + 50 },
      { key: "plannedRenovations", label: "Större planerat underhåll", kind: "longtext", maxLength: 600, hint: "T.ex. tak 2027, fasad 2028 — som det står i förvaltningsberättelsen eller underhållsplanen." },
      { key: "feeChangePct", label: "Beslutad avgiftsförändring", kind: "number", unit: "%", min: -100, max: 300 },
      { key: "feeChangeEffective", label: "Avgiftsförändringen gäller från", kind: "text", maxLength: 80 },
    ],
  },
  {
    title: "Kommentar till kunden",
    fields: [
      { key: "expertComment", label: "Kommentar från granskaren", kind: "longtext", maxLength: 2000, hint: "Visas för kunden som den skrivs." },
    ],
  },
];

export const BRF_FIELD_SPECS: BrfFieldSpec[] = BRF_FIELD_GROUPS.flatMap((g) => g.fields);

/** The seven key figures every annual report since fiscal year 2023 must state (plus soliditet). */
export const MANDATORY_KEY_FIGURES: Array<keyof BrfFigures> = [
  "annualFeePerSqm",
  "debtPerSqmBr",
  "debtPerSqmTotal",
  "savingsPerSqm",
  "interestSensitivityPct",
  "energyCostPerSqm",
  "feeShareOfRevenuePct",
];

function parseNumber(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : "invalid";
  if (typeof value === "string") {
    // Accept Swedish formatting: "7 117", "7 117,5", "−123", "12,9 %".
    const cleaned = value
      .replace(/[\s  ]/g, "")
      .replace(/[−–]/g, "-")
      .replace(/%|kr\/kvm|kr/gi, "")
      .replace(",", ".");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : "invalid";
  }
  return "invalid";
}

function parseBoolean(value: unknown): boolean | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "ja") return true;
  if (value === "false" || value === "nej") return false;
  return "invalid";
}

/**
 * Validates figures coming from the review form (or stored JSON) against
 * BRF_FIELD_SPECS. Unknown keys are dropped; a value of the wrong type or
 * outside its plausible range is reported in `errors` (and left null) so a
 * typing error is caught before a customer ever sees it.
 */
export function parseBrfFigures(raw: unknown): { figures: BrfFigures; errors: string[] } {
  const figures: BrfFigures = { ...EMPTY_BRF_FIGURES };
  const errors: string[] = [];
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  for (const spec of BRF_FIELD_SPECS) {
    const value = input[spec.key];
    switch (spec.kind) {
      case "number": {
        const n = parseNumber(value);
        if (n === "invalid") {
          errors.push(`${spec.label}: ange ett tal.`);
          break;
        }
        if (n === null) break;
        if (spec.integer && !Number.isInteger(n)) {
          errors.push(`${spec.label}: ange ett heltal.`);
          break;
        }
        if ((spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) {
          errors.push(`${spec.label}: ${n} ligger utanför det rimliga intervallet ${spec.min} – ${spec.max}.`);
          break;
        }
        (figures as unknown as Record<string, unknown>)[spec.key] = n;
        break;
      }
      case "boolean": {
        const b = parseBoolean(value);
        if (b === "invalid") errors.push(`${spec.label}: välj ja, nej eller vet ej.`);
        else (figures as unknown as Record<string, unknown>)[spec.key] = b;
        break;
      }
      case "landTenure": {
        if (value === null || value === undefined || value === "") break;
        if (value === "owned" || value === "leasehold") figures.landTenure = value;
        else errors.push(`${spec.label}: välj äganderätt, tomträtt eller vet ej.`);
        break;
      }
      case "text":
      case "longtext": {
        if (value === null || value === undefined) break;
        if (typeof value !== "string") {
          errors.push(`${spec.label}: ange text.`);
          break;
        }
        const text = value.trim();
        if (text === "") break;
        if (spec.maxLength !== undefined && text.length > spec.maxLength) {
          errors.push(`${spec.label}: högst ${spec.maxLength} tecken.`);
          break;
        }
        (figures as unknown as Record<string, unknown>)[spec.key] = text;
        break;
      }
    }
  }

  return { figures, errors };
}

/** True when the reviewer has recorded at least one figure or comment. */
export function hasAnyBrfFigure(figures: BrfFigures): boolean {
  return Object.values(figures).some((v) => v !== null);
}
