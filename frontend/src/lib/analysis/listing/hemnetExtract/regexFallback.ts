/**
 * Final fallback: loose regex over the raw page text, with no assumption
 * about tag structure or embedded JSON at all. Only used for the handful of
 * fields that can plausibly be recognized from bare text, and only ever as
 * the last-resort source in merge.ts — everything here yields to Apollo
 * state, JSON-LD, and semantic HTML when any of those found a value.
 */
import { emptyHemnetPageData, type HemnetPageData } from "./types.ts";
import { parseSekNumber } from "./utils.ts";

const BRF_NAME_PATTERN = /\b((?:Brf|BRF|Bostadsrättsföreningen?)\s+[A-ZÅÄÖ][\wÅÄÖåäö\-.]*(?:\s+[\wÅÄÖåäö\-.]+){0,4})/;

export function extractRegexFallback(html: string): HemnetPageData {
  const data = emptyHemnetPageData();

  const priceMatch = /(\d[\d\s]{5,}\d)\s*(?:kr|SEK)\b/.exec(html);
  if (priceMatch) {
    const parsed = parseSekNumber(priceMatch[1]);
    if (parsed !== null && parsed > 100_000 && parsed < 200_000_000) data.asking_price_sek = parsed;
  }

  const perM2Match = /(\d[\d\s]*\d)\s*kr\s*\/\s*m(?:2|²)/i.exec(html);
  if (perM2Match) {
    const parsed = parseSekNumber(perM2Match[1]);
    if (parsed !== null && parsed > 0) data.price_per_m2_sek = parsed;
  }

  const energyMatch = /energiklass\s*[:\s]*([A-G])\b/i.exec(html);
  if (energyMatch) data.energy_class = energyMatch[1].toUpperCase();

  const brfMatch = BRF_NAME_PATTERN.exec(html);
  if (brfMatch) data.housing_association = brfMatch[1].trim();

  const idMatch = /"(?:objectId|listingId)"\s*:\s*"?(\d{5,})"?/.exec(html);
  if (idMatch) data.object_id = idMatch[1];

  return data;
}
