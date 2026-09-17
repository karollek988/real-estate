/**
 * Turns raw OCR text (from one or more listing screenshots) into a partial
 * ManualListingFields object. Deliberately the same technique as
 * hemnetExtract/regexFallback.ts's last-resort text extractor — a small,
 * fixed set of Swedish real-estate labels ("Utgångspris", "Avgift/månad",
 * "Boarea", "Rum") recognized by regex. OCR text has no layout information
 * left, so this is intentionally conservative: a field is only ever set
 * when a pattern actually matches, never guessed. Fields it can't find stay
 * undefined — the review form then requires the user to fill those in
 * (see ManualEntryForm's required fields), so a bad/partial extraction
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

const NON_ADDRESS_LINE = /kr\b|m²|\brum\b|avgift|byggår|våning|utgångspris|boarea|energiklass|^\d+$/i;

/** Best-effort first line that looks like a street address ("Storgatan 12"), not a price/label/pure number. */
function guessAddress(lines: string[]): string | null {
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

  // Prefer an explicitly labeled price ("Utgångspris"/"Pris"); fall back to
  // any standalone "N NNN NNN kr" only when no label is present, same
  // priority order regexFallback.ts uses for Hemnet HTML.
  // The digit run itself must stay on one line ([\d ], not [\d\s]) — a
  // trailing house number on one OCR line ("Storgatan 5") followed by a
  // price starting on the next must never be read as one glued-together
  // number, only actual space-grouped thousands within a single line
  // ("4 500 000") should.
  const labeledPrice = firstMatch(text, /(?:utgångspris|pris)[^\d]{0,15}(\d[\d ]{4,}\d)[ \t]*kr/i);
  const fallbackPrice = firstMatch(text, /(\d[\d ]{5,}\d)[ \t]*kr\b/i);
  const priceRaw = labeledPrice ?? fallbackPrice;
  if (priceRaw) {
    const parsed = parseSekNumber(priceRaw);
    if (parsed !== null && parsed > 10_000 && parsed < 200_000_000) {
      fields.askingPrice = parsed;
      foundKeys.push("askingPrice");
    }
  }

  const feeRaw = firstMatch(text, /(?:månadsavgift|avgift)[^\d]{0,15}(\d[\d ]*\d)[ \t]*kr/i);
  if (feeRaw) {
    const parsed = parseSekNumber(feeRaw);
    if (parsed !== null && parsed > 0) {
      fields.monthlyFee = parsed;
      foundKeys.push("monthlyFee");
    }
  }

  const areaRaw = firstMatch(text, /boarea[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*m/i) ?? firstMatch(text, /(\d+(?:[.,]\d+)?)\s*m²/i);
  if (areaRaw) {
    const parsed = parseFloat(areaRaw.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 2000) {
      fields.livingArea = parsed;
      foundKeys.push("livingArea");
    }
  }

  const roomsRaw = firstMatch(text, /(\d+(?:[.,]\d+)?)\s*rum\b/i);
  if (roomsRaw) {
    const parsed = parseFloat(roomsRaw.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 30) {
      fields.rooms = parsed;
      foundKeys.push("rooms");
    }
  }

  const floorRaw = firstMatch(text, /våning[^\d-]{0,10}(-?\d+)/i);
  if (floorRaw) {
    fields.floor = parseInt(floorRaw, 10);
    foundKeys.push("floor");
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

  return { fields, foundKeys };
}
