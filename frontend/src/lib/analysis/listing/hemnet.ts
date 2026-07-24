import type { ExtractedProperty } from "../types";

/**
 * Hemnet listing extraction.
 *
 * IMPORTANT: Hemnet's terms ban scraping and automated reading of listing
 * pages (see docs/data-source-inventory.md entry 2). This module therefore
 * NEVER fetches the page — it only parses the URL itself, whose slug encodes
 * property type, rooms, municipality and street address, e.g.:
 *
 *   https://www.hemnet.se/bostad/lagenhet-3rum-vasastan-stockholms-kommun-dalagatan-30,-4tr-21901038
 *
 * Fields the slug cannot provide (price, living area, fees, ...) must come
 * from other data providers or from the user.
 */

const PROPERTY_TYPES: Record<string, string> = {
  lagenhet: "Lägenhet",
  villa: "Villa",
  radhus: "Radhus",
  parhus: "Parhus",
  kedjehus: "Kedjehus",
  fritidshus: "Fritidshus",
  fritidsboende: "Fritidshus",
  tomt: "Tomt",
  gard: "Gård",
  ovrig: "Övrig",
};

export class HemnetUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HemnetUrlError";
  }
}

function titleCase(words: string[]): string {
  return words
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Parse a Hemnet listing URL into property facts. Throws HemnetUrlError when the URL is not a readable listing. */
export function extractFromHemnetUrl(rawUrl: string): ExtractedProperty {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HemnetUrlError("Not a valid URL");
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "hemnet.se") {
    throw new HemnetUrlError("Not a Hemnet URL");
  }

  const match = url.pathname.match(/^\/bostad\/(.+)$/);
  if (!match) {
    throw new HemnetUrlError("Not a Hemnet listing URL (expected a /bostad/... link)");
  }

  const slug = decodeURIComponent(match[1]).toLowerCase().replace(/\/+$/, "");
  // Tokens carry trailing commas in slugs like "dalagatan-30,-4tr"; strip them per token.
  const tokens = slug.split("-").map((t) => t.replace(/,+$/, "")).filter((t) => t.length > 0);

  // Trailing numeric listing id (Hemnet ids are long; street numbers are short).
  let listingId: string | null = null;
  const last = tokens[tokens.length - 1];
  if (last && /^\d{6,}$/.test(last)) {
    listingId = last;
    tokens.pop();
  }

  let propertyType: string | null = null;
  if (tokens.length > 0 && PROPERTY_TYPES[tokens[0]]) {
    propertyType = PROPERTY_TYPES[tokens[0]];
    tokens.shift();
  }

  let rooms: number | null = null;
  const roomsIdx = tokens.findIndex((t) => /^\d+([.,]\d+)?rum$/.test(t));
  if (roomsIdx !== -1) {
    rooms = parseFloat(tokens[roomsIdx].replace("rum", "").replace(",", "."));
    tokens.splice(roomsIdx, 1);
  }

  // Municipality: "...-stockholms-kommun-..." — take the token before "kommun"
  // as a hint only (slugs are ASCII-folded and often genitive, so the
  // canonical municipality comes from geocoding later).
  const kommunIdx = tokens.indexOf("kommun");
  let municipalityHint: string | null = null;
  let areaHint: string | null = null;
  let addressTokens: string[];
  let confidence: "high" | "low" = "high";

  if (kommunIdx > 0) {
    municipalityHint = titleCase([tokens[kommunIdx - 1]]);
    areaHint = kommunIdx > 1 ? tokens.slice(0, kommunIdx - 1).join(" ") : null;
    addressTokens = tokens.slice(kommunIdx + 1);
  } else {
    addressTokens = tokens;
    confidence = "low";
  }

  // Address tokens: street words, then a street number, then extras such as
  // "4tr" (floor) or "lgh 1203" (apartment number).
  const streetWords: string[] = [];
  let streetNumber: string | null = null;
  let floor: number | null = null;
  let apartmentNumber: string | null = null;

  for (let i = 0; i < addressTokens.length; i++) {
    const token = addressTokens[i];
    const floorMatch = token.match(/^(\d+)([.,]5)?tr$/);
    if (floorMatch) {
      floor = parseInt(floorMatch[1], 10);
      continue;
    }
    if (token === "lgh" && addressTokens[i + 1] && /^\d+$/.test(addressTokens[i + 1])) {
      apartmentNumber = `lgh ${addressTokens[i + 1]}`;
      i++;
      continue;
    }
    if (streetNumber === null && /^\d+[a-z]?$/.test(token) && streetWords.length > 0) {
      streetNumber = token.toUpperCase();
      continue;
    }
    streetWords.push(token);
  }

  if (streetWords.length === 0) {
    throw new HemnetUrlError("Could not read an address from this Hemnet link");
  }

  const address = streetNumber
    ? `${titleCase(streetWords)} ${streetNumber}`
    : titleCase(streetWords);
  if (!streetNumber) confidence = "low";

  return {
    address,
    municipality: municipalityHint,
    postalCode: null,
    propertyType,
    apartmentNumber,
    floor,
    rooms,
    hemnetUrl: `${url.origin}${url.pathname}`,
    attributes: {
      entry: "hemnet_url",
      hemnet_listing_id: listingId,
      raw_slug: slug,
      area_hint: areaHint,
      extraction_confidence: confidence,
      ...(rooms !== null ? { rooms } : {}),
    },
  };
}
