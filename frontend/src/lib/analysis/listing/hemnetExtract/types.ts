/**
 * Shared shape for a Hemnet listing, plus the per-source extraction contract.
 *
 * Every extractor in this directory (apollo, jsonld, semanticHtml, regexFallback)
 * returns a fully-populated HemnetPageData — unfound fields stay null/[] — so
 * merge.ts can compare same-shaped candidates from every source field-by-field
 * instead of juggling partial objects.
 */
export interface HemnetPageData {
  street_address: string | null;
  asking_price_sek: number | null;
  price_per_m2_sek: number | null;
  living_area_m2: number | null;
  additional_area_m2: number | null;
  monthly_fee_sek: number | null;
  operating_costs_sek: number | null;
  building_year: number | null;
  energy_class: string | null;
  description: string | null;
  image_urls: string[];
  floorplan_urls: string[];
  rooms: number | null;
  floor: string | null;
  apartment_number: string | null;
  broker: string | null;
  agency: string | null;
  listing_date: string | null;
  property_type: string | null;
  condition: string | null;
  balcony: boolean | null;
  elevator: boolean | null;
  parking: boolean | null;
  garage: boolean | null;
  storage: boolean | null;
  patio: boolean | null;
  ownership_type: string | null;
  lot_area_m2: number | null;
  construction_year: number | null;
  renovation_year: number | null;
  housing_association: string | null;
  object_id: string | null;
  features: string[];
  fireplace: boolean | null;
  new_construction: boolean | null;
}

export function emptyHemnetPageData(): HemnetPageData {
  return {
    street_address: null,
    asking_price_sek: null,
    price_per_m2_sek: null,
    living_area_m2: null,
    additional_area_m2: null,
    monthly_fee_sek: null,
    operating_costs_sek: null,
    building_year: null,
    energy_class: null,
    description: null,
    image_urls: [],
    floorplan_urls: [],
    rooms: null,
    floor: null,
    apartment_number: null,
    broker: null,
    agency: null,
    listing_date: null,
    property_type: null,
    condition: null,
    balcony: null,
    elevator: null,
    parking: null,
    garage: null,
    storage: null,
    patio: null,
    ownership_type: null,
    lot_area_m2: null,
    construction_year: null,
    renovation_year: null,
    housing_association: null,
    object_id: null,
    features: [],
    fireplace: null,
    new_construction: null,
  };
}

/**
 * One extractor's output, tagged with where it came from so merge.ts can
 * prioritize and so callers can report per-source coverage.
 */
export type ExtractionSource = "apollo" | "jsonld" | "html" | "regex";

export interface ExtractionResult {
  source: ExtractionSource;
  data: HemnetPageData;
}
