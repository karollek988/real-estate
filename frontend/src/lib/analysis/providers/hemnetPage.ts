import type { DataProvider, ProviderResult } from "./types";
import { scrapeHemnetPage, type HemnetPageData } from "../listing/hemnetPage";

/**
 * Real provider: Hemnet listing page scraper.
 *
 * Fetches the actual Hemnet listing page and extracts ALL available property
 * data: price, living area, fees, building year, energy class, description,
 * images, broker, listing date, condition, balcony, elevator, parking, etc.
 *
 * This is the primary data recovery path — the URL-only parser (hemnet.ts)
 * only extracts address/type/rooms from the slug; this provider fills in
 * everything else that's on the listing page.
 */
export const hemnetPageProvider: DataProvider = {
  id: "hemnet_page_scrape",
  name: "Hemnet listing data",
  kind: "real",

  async collect({ extracted }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;

    if (!extracted.hemnetUrl) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "No Hemnet URL provided." },
        data: {},
      };
    }

    const pageData = await scrapeHemnetPage(extracted.hemnetUrl);
    if (!pageData) {
      return {
        source: { ...base, status: "error", fields: [], detail: "Could not fetch or parse the Hemnet listing page." },
        data: {},
      };
    }

    const data = mapPageDataToAttributes(pageData);
    const fields = Object.keys(data);

    if (fields.length === 0) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "Hemnet page was fetched but no extractable data was found." },
        data: {},
      };
    }

    return { source: { ...base, status: "ok", fields }, data };
  },
};

/**
 * Map scraped Hemnet page data to pipeline attribute names.
 * Only includes fields that were actually found (non-null).
 */
export function mapPageDataToAttributes(pageData: HemnetPageData): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};

  // Street address with correct diacritics — the URL-slug parser (hemnet.ts)
  // is ASCII-folded (Hemnet strips å/ä/ö/é from slugs), so this scraped value
  // is strictly more accurate whenever it's present.
  if (pageData.street_address !== null) attrs.street_address = pageData.street_address;

  // Core economic data
  if (pageData.asking_price_sek !== null) attrs.asking_price_sek = pageData.asking_price_sek;
  if (pageData.price_per_m2_sek !== null) attrs.price_per_m2_sek = pageData.price_per_m2_sek;
  if (pageData.living_area_m2 !== null) attrs.living_area_m2 = pageData.living_area_m2;
  if (pageData.additional_area_m2 !== null) attrs.additional_area_m2 = pageData.additional_area_m2;
  if (pageData.monthly_fee_sek !== null) attrs.monthly_fee_sek = pageData.monthly_fee_sek;
  if (pageData.operating_costs_sek !== null) attrs.operating_costs_sek = pageData.operating_costs_sek;

  // Property details
  if (pageData.building_year !== null) attrs.building_year = pageData.building_year;
  if (pageData.construction_year !== null && attrs.building_year === undefined) {
    attrs.building_year = pageData.construction_year;
  }
  if (pageData.renovation_year !== null) attrs.renovation_year = pageData.renovation_year;
  if (pageData.energy_class !== null) attrs.energy_class = pageData.energy_class;
  if (pageData.condition !== null) attrs.condition = pageData.condition;
  if (pageData.ownership_type !== null) attrs.ownership_type = pageData.ownership_type;

  // Boolean features
  if (pageData.balcony !== null) attrs.balcony = pageData.balcony;
  if (pageData.elevator !== null) attrs.elevator = pageData.elevator;
  if (pageData.parking !== null) attrs.parking = pageData.parking;
  if (pageData.garage !== null) attrs.garage = pageData.garage;
  if (pageData.storage !== null) attrs.storage = pageData.storage;
  if (pageData.patio !== null) attrs.patio = pageData.patio;
  if (pageData.fireplace !== null) attrs.fireplace = pageData.fireplace;
  if (pageData.new_construction !== null) attrs.new_construction = pageData.new_construction;

  // Contact info
  if (pageData.broker !== null) attrs.broker = pageData.broker;
  if (pageData.agency !== null) attrs.agency = pageData.agency;

  // Listing metadata
  if (pageData.listing_date !== null) attrs.listing_date = pageData.listing_date;
  if (pageData.description !== null) attrs.description = pageData.description;
  if (pageData.image_urls.length > 0) attrs.image_urls = pageData.image_urls;
  if (pageData.floorplan_urls.length > 0) attrs.floorplan_urls = pageData.floorplan_urls;
  if (pageData.features.length > 0) attrs.features = pageData.features;
  if (pageData.object_id !== null) attrs.hemnet_object_id = pageData.object_id;

  // Room/floor data (may override URL-slug extraction with more precise data)
  if (pageData.rooms !== null) attrs.rooms = pageData.rooms;
  if (pageData.floor !== null && !attrs.floor) attrs.floor = pageData.floor;
  if (pageData.apartment_number !== null && !attrs.apartment_number) {
    attrs.apartment_number = pageData.apartment_number;
  }

  // Property type (may be more specific from page than URL slug)
  if (pageData.property_type !== null) attrs.property_type_hemnet = pageData.property_type;

  // Lot area
  if (pageData.lot_area_m2 !== null) attrs.lot_area_m2 = pageData.lot_area_m2;

  // Housing association name (identity-protected: booli_listing remains the
  // trusted source if it disagrees, see identityTrust.ts — this only fills
  // the field in when nothing has claimed it yet).
  if (pageData.housing_association !== null) attrs.housing_association = pageData.housing_association;

  return attrs;
}
