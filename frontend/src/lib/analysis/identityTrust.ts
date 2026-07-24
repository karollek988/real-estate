/**
 * Identity fields where a lower-trust source must never silently overwrite
 * an already-known value (End-to-End Truth Audit finding #2: brf_acquisition's
 * Allabrf name match can be wrong — see discovery/allabrf_provider.py's
 * ambiguity gate — and used to unconditionally overwrite the housing
 * association name booliListingProvider already found from the real listing).
 *
 * Maps each protected field to the one provider trusted to set/update it
 * freely (the listing provider itself, which always reflects this run's
 * fresh data — including correcting a stale value from a prior run). Any
 * OTHER provider may only fill the field in when it's still unknown; it may
 * never replace an existing value, and a differing value is recorded rather
 * than silently dropped.
 */
export const TRUSTED_IDENTITY_SOURCE: Record<string, string> = {
  // Hemnet's page scraper (hemnetPage.ts) fetches the listing's own URL — a
  // perfect identity match. Booli's /listings and /sold endpoints (and
  // Parse.bot's Booli.se scraper, providers/parseBotBooli.ts) are free-text
  // search (see providers/booli.ts::addressesMatch) and, even after that
  // guard runs, can describe a slightly different unit in the same
  // building. These fields exist on more than one source; Hemnet is ground
  // truth for the live listing, the others may only fill a gap Hemnet left
  // open.
  //
  // housing_association was previously trusted to "booli_listing", but
  // that provider's rewrite (2026-07-22) stopped setting this field at all
  // (it has no verified equivalent on the real Booli Property object) —
  // that made the entry a dead trust grant nobody could use. Now that
  // brf_acquisition and parsebot_booli are both real, independent
  // candidate writers for this field, Hemnet is the consistent choice,
  // matching every other dual-source field below.
  housing_association: "hemnet_page_scrape",
  asking_price_sek: "hemnet_page_scrape",
  monthly_fee_sek: "hemnet_page_scrape",
  additional_area_m2: "hemnet_page_scrape",
  lot_area_m2: "hemnet_page_scrape",
  living_area_m2: "hemnet_page_scrape",
  rooms: "hemnet_page_scrape",
  floor: "hemnet_page_scrape",
  building_year: "hemnet_page_scrape",
  balcony: "hemnet_page_scrape",
  patio: "hemnet_page_scrape",
  elevator: "hemnet_page_scrape",
  listing_date: "hemnet_page_scrape",
  // Also settable by hemnetPage.ts but previously unprotected — closing the
  // same latent gap now that parsebot_booli is a second candidate writer.
  agency: "hemnet_page_scrape",
  operating_costs_sek: "hemnet_page_scrape",
  description: "hemnet_page_scrape",
  // Booli-domain facts: both booli_listing (the direct API) and
  // parsebot_booli (Parse.bot's scrape of the same source) can each
  // independently produce these via their own free-text address match —
  // the direct API is the more authoritative of the two when configured.
  booli_id: "booli_listing",
  booli_listing_url: "booli_listing",
  property_type_booli: "booli_listing",
  previous_sale_price_sek: "booli_listing",
  previous_sale_date: "booli_listing",
  comparable_sales: "booli_listing",
  comparable_sales_count: "booli_listing",
  area_median_price_per_m2_sek: "booli_listing",
  area_sold_price_trend: "booli_listing",
  fireplace: "booli_listing",
  solar_panels: "booli_listing",
  new_construction: "booli_listing",
  bidding_open: "booli_listing",
  mortgage_deed: "booli_listing",
};

export function applyProtectedIdentityFields(
  data: Record<string, unknown>,
  existingAttributes: Record<string, unknown>,
  sourceId: string
): Record<string, unknown> {
  const patch = { ...data };
  for (const [field, trustedSourceId] of Object.entries(TRUSTED_IDENTITY_SOURCE)) {
    if (!(field in patch)) continue;
    if (sourceId === trustedSourceId) continue; // the trusted source may always write/update

    const existing = existingAttributes[field];
    const hasExisting = existing !== undefined && existing !== null && existing !== "";
    if (!hasExisting) continue;

    if (existing !== patch[field]) {
      // Expose the disagreement instead of silently resolving it.
      patch[`${field}_conflict`] = {
        keptValue: existing,
        rejectedValue: patch[field],
        rejectedSource: sourceId,
      };
    }
    delete patch[field];
  }
  return patch;
}
