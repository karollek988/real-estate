import type { FieldProvenance } from "../types";

/**
 * Per-provider confidence used only to populate field-level provenance
 * (pipeline.ts's field-provenance choke point) — NOT the same number as
 * DecisionFactorResult.confidence (engine/analyzers/*), which covers a whole
 * analysis factor, not a single field. Higher = the source more directly
 * verified this exact property (a direct URL fetch outranks an address-
 * matched free-text search, which outranks a scrape of that search).
 */
export const PROVIDER_CONFIDENCE: Record<string, number> = {
  hemnet_page_scrape: 0.95,
  nominatim_geocoding: 0.9,
  interest_rates: 0.9,
  scb_area_statistics: 0.85,
  smhi_climate: 0.85,
  osm_amenities: 0.8,
  infrastructure_projects: 0.8,
  booli_listing: 0.75,
  brf_acquisition: 0.7,
  brf_financials: 0.7,
  location_intelligence: 0.7,
  market_intelligence: 0.7,
  // One hop of indirection further than booli_listing: a third-party scrape
  // of Booli rather than Booli's own API.
  parsebot_booli: 0.65,
};

export const DEFAULT_PROVIDER_CONFIDENCE = 0.5;

export function confidenceFor(providerId: string): number {
  return PROVIDER_CONFIDENCE[providerId] ?? DEFAULT_PROVIDER_CONFIDENCE;
}

/** Stamps {source, confidence, updatedAt} for each field a provider just wrote. */
export function recordFieldProvenance(
  existing: FieldProvenance,
  fieldsWritten: string[],
  providerId: string,
  now: string = new Date().toISOString()
): FieldProvenance {
  if (fieldsWritten.length === 0) return existing;
  const confidence = confidenceFor(providerId);
  const next = { ...existing };
  for (const field of fieldsWritten) {
    next[field] = { source: providerId, confidence, updatedAt: now };
  }
  return next;
}
