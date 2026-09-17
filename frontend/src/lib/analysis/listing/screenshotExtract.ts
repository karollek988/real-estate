/**
 * Turns raw OCR text (from one or more listing screenshots) into a partial
 * ManualListingFields object. Deliberately the same technique as
 * hemnetExtract/regexFallback.ts's last-resort text extractor — a small,
 * fixed set of Swedish real-estate labels recognized by regex. OCR text has
 * no layout information left, and a two-column detail table can come back
 * as "all labels, then all values" instead of row by row — so most numeric
 * fields below prefer a value immediately after its label, but fall back to
 * "the only plausible candidate anywhere in the text" when that specific
 * label/value pairing isn't found, rather than giving up. That fallback
 * only fires when there's exactly one candidate (never a guess between
 * several) and only when the field's own label appears somewhere in the
 * text at all (so a scrambled "avgift" value is never borrowed by
 * "driftskostnader" just because it's the only kr/mån figure left).
 * A field that can't be pinned down this way stays undefined — the review
 * form then requires the user to fill it in — so a bad/partial extraction
 * degrades to "the user finishes the form," never a wrong silent value.
 */
import { parseSekNumber } from "./hemnetExtract/utils.ts";
import type { ManualListingFields } from "./manual";

export interface ScreenshotExtractionResult {
  fields: Partial<ManualListingFields>;
  /** Which ManualListingFields keys a pattern actually matched, for the review UI to highlight. */
  foundKeys: string[];
}

const PROPERTY_TYPE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /bostadsrätt\s*\(?nyproduktion\)?/i, value: "Bostadsrätt (nyproduktion)" },
  { pattern: /bostadsrätt/i, value: "Bostadsrätt" },
  { pattern: /äganderätt/i, value: "Äganderätt" },
  { pattern: /arrende/i, value: "Arrende" },
];

// Well-known Swedish real-estate brands, matched verbatim rather than
// guessed — a name has no numeric shape to sanity-check the way a price or
// area does, so this only ever fires on an exact, unambiguous brand match.
// Not exhaustive; smaller/local agencies won't be recognized.
const KNOWN_AGENCIES = [
  "Fantastic Frank",
  "Svensk Fastighetsförmedling",
  "Erik Olsson Fastighetsförmedling",
  "HusmanHagberg",
  "Länsförsäkringar Fastighetsförmedling",
  "Bjurfors",
  "Skandiamäklarna",
  "Notar",
  "Mäklarhuset",
  "Fastighetsbyrån",
  "Innerstadsmäklarna",
  "Historiska Hem",
  "Widerlöv",
  "Alexander White",
  "Södermäklarna",
  "SkeppsholmenMäklaren",
];

const NON_ADDRESS_LINE =
  /kr\b|m²|\brum\b|avgift|byggår|våning|utgångspris|boarea|energiklass|^\d+$|\b(mån|tis|ons|tors|fre|lör|sön)\b|\bkl\.?\s*\d{1,2}[:.]\d{2}\b|\d{1,2}[:.]\d{2}\s*-\s*\d{1,2}[:.]\d{2}|visningstid/i;

// Swedish street names overwhelmingly end in one of these suffixes. A line
// that's just "<Street name><suffix>[ <number>]" is a far more specific
// address signal than "has a capital letter and a digit" (below) — and
// real listings often show the street name with no house number at all in
// the header, which the digit-based fallback can never catch.
const STREET_SUFFIX_LINE =
  /^[A-ZÅÄÖ][a-zA-ZåäöÅÄÖ]*(?:vägen|gatan|gränd(?:en)?|torg(?:et)?|allén|stigen|backen|plan(?:en)?|parken|ringen|esplanaden)\b.{0,10}$/;

/**
 * Best-effort address: a street-suffix line ("Augustendalsvägen"), combined
 * with the next line if it names a "...kommun" (giving "Street, Area,
 * X kommun" — the same shape a manually-typed address would have). Falls
 * back to the original heuristic (first line with a capital letter and a
 * digit, that isn't obviously a price/label/viewing-time line) only when no
 * street-suffix line is found at all.
 */
function guessAddress(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length < 3 || trimmed.length > 60) continue;
    if (!STREET_SUFFIX_LINE.test(trimmed)) continue;
    const next = lines[i + 1]?.trim();
    if (next && next.length <= 60 && /kommun/i.test(next)) {
      return `${trimmed}, ${next}`;
    }
    return trimmed;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 5 || trimmed.length > 60) continue;
    if (NON_ADDRESS_LINE.test(trimmed)) continue;
    if (!/[A-ZÅÄÖ]/.test(trimmed)) continue;
    if (/\d/.test(trimmed)) return trimmed;
  }
  return null;
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);
  return match ? match[1] : null;
}

function parseDecimal(raw: string): number | null {
  const parsed = parseFloat(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Prefers `value` immediately after `label`; if that specific pairing isn't
 * found, falls back to a candidate pattern searched across the whole text —
 * but only when `labelPresence` appears *somewhere* (so this field doesn't
 * silently adopt a figure that actually belongs to a different field), and
 * only when exactly one distinct candidate value exists (never a guess
 * between several).
 */
function labeledOrUniqueValue(
  text: string,
  labelPresence: RegExp | null,
  labeledPattern: RegExp,
  candidatePattern: RegExp,
  parse: (raw: string) => number | null,
  isValid: (n: number) => boolean
): number | null {
  const labeledRaw = firstMatch(text, labeledPattern);
  if (labeledRaw !== null) {
    const parsed = parse(labeledRaw);
    if (parsed !== null && isValid(parsed)) return parsed;
  }
  if (labelPresence && !labelPresence.test(text)) return null;

  const flags = candidatePattern.flags.includes("g") ? candidatePattern.flags : `${candidatePattern.flags}g`;
  const re = new RegExp(candidatePattern.source, flags);
  const values = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const parsed = parse(m[1]);
    if (parsed !== null && isValid(parsed)) values.add(parsed);
  }
  return values.size === 1 ? [...values][0] : null;
}

/** True if `pattern` matches somewhere it isn't itself negated ("ingen hiss" must never read as elevator: Ja). */
function hasPositiveTag(text: string, pattern: RegExp): boolean {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 15), m.index);
    if (/\b(?:ingen|inga|utan|nej|ej)\b\s*$/i.test(before)) continue;
    return true;
  }
  return false;
}

function findKnownAgency(text: string): string | null {
  for (const name of KNOWN_AGENCIES) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) return name;
  }
  return null;
}

// A line that's exactly two Title-Case words (not ALL-CAPS, which is how
// agency branding like "FANTASTIC FRANK" tends to render) near the broker
// contact panel's own buttons is a reasonable, if lower-confidence, signal
// for the agent's name — Hemnet has no other structural marker for it in
// OCR'd text.
const NAME_LINE = /^[A-ZÅÄÖ][a-zåäö'-]+\s[A-ZÅÄÖ][a-zåäö'-]+$/;
const CONTACT_PANEL_SIGNAL = /\bmejla\b|visa telefonnummer|kontakta mäklaren/i;

function guessBroker(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!NAME_LINE.test(trimmed)) continue;
    const nearby = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 4)).join(" ");
    if (CONTACT_PANEL_SIGNAL.test(nearby)) return trimmed;
  }
  return null;
}

export function extractFromScreenshotText(rawTexts: string[]): ScreenshotExtractionResult {
  const text = rawTexts.filter(Boolean).join("\n");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fields: Partial<ManualListingFields> = {};
  const foundKeys: string[] = [];

  const address = guessAddress(lines);
  if (address) {
    fields.address = address;
    foundKeys.push("address");
  }

  // Price extraction deliberately never trusts a bare "Pris" as a label —
  // it collides with "Pris/m²", "Prisidé", "Prisutveckling", etc. too often
  // (a real bug: a per-m² figure outranked the actual price because it was
  // the only "pris...kr" match on the page). Only "Utgångspris"/"Slutpris"
  // are specific enough to trust directly. Everything else falls through to
  // "largest absolute kr amount on the page that isn't a per-unit rate" —
  // safe because the asking price is essentially always the largest single
  // kr figure a listing shows, regardless of what order OCR read the page
  // in (multi-column layouts do not preserve visual reading order).
  const RATE_SUFFIX = /^\s*\/\s*(?:m2|m²|kvm|mån(?:ad)?|år)\b/i;

  function nonRatePriceValues(haystack: string): number[] {
    const values: number[] = [];
    // The digit run itself must stay on one line ([\d ], not [\d\s]) — a
    // trailing house number on one OCR line ("Storgatan 5") followed by a
    // price starting on the next must never be read as one glued-together
    // number, only actual space-grouped thousands within a single line
    // ("4 500 000") should.
    const re = /(\d[\d ]{4,}\d)[ \t]*kr\b/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(haystack))) {
      const tail = haystack.slice(m.index + m[0].length, m.index + m[0].length + 12);
      if (RATE_SUFFIX.test(tail)) continue;
      const parsed = parseSekNumber(m[1]);
      if (parsed !== null && parsed > 10_000 && parsed < 200_000_000) values.push(parsed);
    }
    return values;
  }

  const labeledPrice = firstMatch(
    text,
    /(?:utgångspris|slutpris)[^\d]{0,15}(\d[\d ]{4,}\d)[ \t]*kr\b(?!\s*\/\s*(?:m2|m²|kvm|mån(?:ad)?|år))/i
  );
  const priceCandidates = nonRatePriceValues(text);
  const priceRaw = labeledPrice ? parseSekNumber(labeledPrice) : null;
  const parsedPrice = priceRaw ?? (priceCandidates.length > 0 ? Math.max(...priceCandidates) : null);
  if (parsedPrice !== null && parsedPrice > 10_000 && parsedPrice < 200_000_000) {
    fields.askingPrice = parsedPrice;
    foundKeys.push("askingPrice");
  }

  // "Avgift" and "Driftskostnader" are both shown as "N NNN kr/mån" —
  // structurally identical, so the unlabeled fallback below only ever
  // resolves a field when *that field's own* label text appears somewhere
  // (even far from its value) and there's exactly one kr/mån figure left to
  // attribute to it; otherwise it leaves the field blank rather than
  // guessing which figure belongs to which label.
  const RATE_PER_MONTH = /(\d[\d ]*\d)[ \t]*kr\s*\/\s*mån(?:ad)?\b/i;

  const monthlyFeeValue = labeledOrUniqueValue(
    text,
    /(?:månadsavgift|avgift)/i,
    /(?:månadsavgift|avgift)[^\d]{0,15}(\d[\d ]*\d)[ \t]*kr\b/i,
    RATE_PER_MONTH,
    parseSekNumber,
    (n) => n > 0
  );
  if (monthlyFeeValue !== null) {
    fields.monthlyFee = monthlyFeeValue;
    foundKeys.push("monthlyFee");
  }

  const operatingCostsValue = labeledOrUniqueValue(
    text,
    /driftskostnad(?:er)?/i,
    /driftskostnad(?:er)?[^\d]{0,15}(\d[\d ]*\d)[ \t]*kr\b/i,
    RATE_PER_MONTH,
    parseSekNumber,
    (n) => n > 0
  );
  if (operatingCostsValue !== null) {
    fields.operatingCosts = operatingCostsValue;
    foundKeys.push("operatingCosts");
  }

  // "m²" sometimes OCRs as the single CJK compatibility glyph "㎡" instead
  // of "m" + "²" — recognized everywhere an area unit is matched below.
  const livingAreaValue = labeledOrUniqueValue(
    text,
    null, // no other field competes for an "N m²" figure, so no ownership gate is needed here
    /boarea[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*(?:m²|m2|㎡)/i,
    /(\d+(?:[.,]\d+)?)\s*(?:m²|m2|㎡)/i,
    parseDecimal,
    (n) => n > 0 && n < 2000
  );
  if (livingAreaValue !== null) {
    fields.livingArea = livingAreaValue;
    foundKeys.push("livingArea");
  }

  const roomsRaw = firstMatch(text, /(\d+(?:[.,]\d+)?)\s*rum\b/i);
  if (roomsRaw) {
    const parsed = parseFloat(roomsRaw.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 30) {
      fields.rooms = parsed;
      foundKeys.push("rooms");
    }
  }

  // "9, hiss finns" is how Hemnet shows floor+elevator together in one
  // cell — worth recognizing directly since it gives the floor number even
  // when it's landed far from the literal word "Våning" in OCR'd text.
  const floorRaw =
    firstMatch(text, /våning[^\d-]{0,10}(-?\d+)/i) ?? firstMatch(text, /(-?\d{1,2})\s*,\s*hiss finns\b/i);
  if (floorRaw) {
    const parsed = parseInt(floorRaw, 10);
    if (Number.isFinite(parsed) && parsed >= -3 && parsed <= 100) {
      fields.floor = parsed;
      foundKeys.push("floor");
    }
  }

  const yearRaw = firstMatch(text, /byggår[^\d]{0,10}(\d{4})/i);
  if (yearRaw) {
    const parsed = parseInt(yearRaw, 10);
    if (parsed > 1700 && parsed <= new Date().getFullYear()) {
      fields.buildingYear = parsed;
      foundKeys.push("buildingYear");
    }
  }

  const energyMatch = /energiklass\s*[:\s]*([A-G])\b/i.exec(text);
  if (energyMatch) {
    fields.energyClass = energyMatch[1].toUpperCase();
    foundKeys.push("energyClass");
  }

  for (const { pattern, value } of PROPERTY_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      fields.propertyType = value;
      foundKeys.push("propertyType");
      break;
    }
  }

  // Balcony/elevator/parking are shown on Hemnet as tags that only ever
  // appear when true (there's no "Balkong: Nej" tag) — so their absence is
  // not evidence of "Nej", only "Ja" is ever set, and a nearby negation
  // ("ingen hiss") is honored rather than misread as a positive mention.
  if (hasPositiveTag(text, /balkong/i)) {
    fields.balcony = "Ja";
    foundKeys.push("balcony");
  }
  if (hasPositiveTag(text, /hiss/i)) {
    fields.elevator = "Ja";
    foundKeys.push("elevator");
  }
  if (hasPositiveTag(text, /parkering|garage|\bp-plats\b|carport/i)) {
    fields.parking = "Ja";
    foundKeys.push("parking");
  }

  const agency = findKnownAgency(text);
  if (agency) {
    fields.agency = agency;
    foundKeys.push("agency");
  }

  const broker = guessBroker(lines);
  if (broker) {
    fields.broker = broker;
    foundKeys.push("broker");
  }

  return { fields, foundKeys };
}
