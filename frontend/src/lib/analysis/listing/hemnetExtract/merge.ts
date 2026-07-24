/**
 * Combines candidates from every extraction source into one HemnetPageData.
 *
 * Every source runs unconditionally (see hemnetPage.ts) and contributes
 * whatever it found; nothing here short-circuits on the first non-null
 * value from a single source. Scalar fields resolve by source priority —
 * Apollo state (the app's own structured data) beats JSON-LD (standardized
 * but thin on this site today) beats semantic HTML (meta tags/label pairs)
 * beats raw regex (no structural guarantee at all). Array fields union
 * every source instead of picking one, since different sources often see
 * different subsets (e.g. Apollo's image gallery vs. JSON-LD's single
 * `og:image`-equivalent).
 */
import { emptyHemnetPageData, type ExtractionResult, type HemnetPageData } from "./types.ts";
import { dedupe } from "./utils.ts";

type Scalar = string | number | boolean | null;

function pick<T extends Scalar>(...candidates: T[]): T {
  for (const candidate of candidates) {
    if (candidate !== null) return candidate;
  }
  return null as T;
}

export function mergeExtractions(results: ExtractionResult[]): HemnetPageData {
  const bySource = Object.fromEntries(results.map((r) => [r.source, r.data])) as Record<
    ExtractionResult["source"],
    HemnetPageData
  >;
  const apollo = bySource.apollo ?? emptyHemnetPageData();
  const jsonld = bySource.jsonld ?? emptyHemnetPageData();
  const html = bySource.html ?? emptyHemnetPageData();
  const regex = bySource.regex ?? emptyHemnetPageData();

  const data = emptyHemnetPageData();

  data.street_address = pick(apollo.street_address, jsonld.street_address, html.street_address, regex.street_address);
  data.asking_price_sek = pick(apollo.asking_price_sek, jsonld.asking_price_sek, html.asking_price_sek, regex.asking_price_sek);
  data.price_per_m2_sek = pick(apollo.price_per_m2_sek, jsonld.price_per_m2_sek, html.price_per_m2_sek, regex.price_per_m2_sek);
  data.living_area_m2 = pick(apollo.living_area_m2, jsonld.living_area_m2, html.living_area_m2, regex.living_area_m2);
  data.additional_area_m2 = pick(apollo.additional_area_m2, jsonld.additional_area_m2, html.additional_area_m2, regex.additional_area_m2);
  data.monthly_fee_sek = pick(apollo.monthly_fee_sek, jsonld.monthly_fee_sek, html.monthly_fee_sek, regex.monthly_fee_sek);
  data.operating_costs_sek = pick(apollo.operating_costs_sek, jsonld.operating_costs_sek, html.operating_costs_sek, regex.operating_costs_sek);
  data.building_year = pick(apollo.building_year, jsonld.building_year, html.building_year, regex.building_year);
  data.construction_year = pick(apollo.construction_year, jsonld.construction_year, html.construction_year, regex.construction_year);
  data.energy_class = pick(apollo.energy_class, jsonld.energy_class, html.energy_class, regex.energy_class);
  data.rooms = pick(apollo.rooms, jsonld.rooms, html.rooms, regex.rooms);
  data.floor = pick(apollo.floor, jsonld.floor, html.floor, regex.floor);
  data.apartment_number = pick(apollo.apartment_number, jsonld.apartment_number, html.apartment_number, regex.apartment_number);
  data.broker = pick(apollo.broker, jsonld.broker, html.broker, regex.broker);
  data.agency = pick(apollo.agency, jsonld.agency, html.agency, regex.agency);
  data.listing_date = pick(apollo.listing_date, jsonld.listing_date, html.listing_date, regex.listing_date);
  data.property_type = pick(apollo.property_type, jsonld.property_type, html.property_type, regex.property_type);
  data.condition = pick(apollo.condition, jsonld.condition, html.condition, regex.condition);
  data.balcony = pick(apollo.balcony, jsonld.balcony, html.balcony, regex.balcony);
  data.elevator = pick(apollo.elevator, jsonld.elevator, html.elevator, regex.elevator);
  data.parking = pick(apollo.parking, jsonld.parking, html.parking, regex.parking);
  data.garage = pick(apollo.garage, jsonld.garage, html.garage, regex.garage);
  data.storage = pick(apollo.storage, jsonld.storage, html.storage, regex.storage);
  data.patio = pick(apollo.patio, jsonld.patio, html.patio, regex.patio);
  data.ownership_type = pick(apollo.ownership_type, jsonld.ownership_type, html.ownership_type, regex.ownership_type);
  data.lot_area_m2 = pick(apollo.lot_area_m2, jsonld.lot_area_m2, html.lot_area_m2, regex.lot_area_m2);
  data.renovation_year = pick(apollo.renovation_year, jsonld.renovation_year, html.renovation_year, regex.renovation_year);
  data.housing_association = pick(apollo.housing_association, jsonld.housing_association, html.housing_association, regex.housing_association);
  data.object_id = pick(apollo.object_id, jsonld.object_id, html.object_id, regex.object_id);
  data.fireplace = pick(apollo.fireplace, jsonld.fireplace, html.fireplace, regex.fireplace);
  data.new_construction = pick(apollo.new_construction, jsonld.new_construction, html.new_construction, regex.new_construction);

  data.description = resolveDescription(apollo.description, html.description, jsonld.description);

  data.image_urls = dedupe([...apollo.image_urls, ...jsonld.image_urls, ...html.image_urls]);
  data.floorplan_urls = dedupe([...apollo.floorplan_urls, ...html.floorplan_urls]);
  data.features = dedupe([...apollo.features, ...html.features]);

  enrichFromDescription(data);

  return data;
}

/**
 * Apollo's `description` is the listing's actual CMS text (paragraph breaks
 * intact); JSON-LD's is the same copy with whitespace collapsed; semantic
 * HTML's is either a truncated `og:description` or a heading-section scrape.
 * Apollo wins whenever it clears the "this is real prose, not a teaser"
 * length bar; otherwise fall back to whichever candidate is longest.
 */
const MIN_FULL_DESCRIPTION_LENGTH = 60;

function resolveDescription(...candidates: (string | null)[]): string | null {
  const [apolloText] = candidates;
  if (apolloText && apolloText.length >= MIN_FULL_DESCRIPTION_LENGTH) return apolloText;

  const real = candidates
    .filter((c): c is string => !!c && c.trim().length > 0)
    .sort((a, b) => b.length - a.length);
  return real[0] ?? null;
}

/**
 * Hemnet's Apollo state doesn't carry `condition` or `renovation_year` as
 * dedicated fields (verified on real listings, 2026-07) — the only place
 * that information shows up at all is free text. Best-effort regex over the
 * already-resolved description, run once merge has picked the best text
 * available rather than duplicated per-source.
 */
function enrichFromDescription(data: HemnetPageData): void {
  if (!data.description) return;

  if (data.renovation_year === null) {
    const match = /renover(?:ad|ing|at)[a-zåäö]*\D{0,15}(\d{4})/i.exec(data.description);
    const year = match ? parseInt(match[1], 10) : NaN;
    if (Number.isFinite(year) && year > 1900 && year <= new Date().getFullYear()) {
      data.renovation_year = year;
    }
  }

  if (data.condition === null) {
    const skickMatch = /([\wåäöÅÄÖ]+(?:\s+[\wåäöÅÄÖ]+){0,2}\s+skick)/i.exec(data.description);
    if (skickMatch) {
      data.condition = skickMatch[1].trim();
    } else {
      // Standard Swedish listing-condition vocabulary that doesn't use the
      // word "skick" itself (e.g. "helrenoverad", "välvårdad villa").
      const adjectiveMatch =
        /\b((?:hel|total|ny|del(?:vis)?)?renoverad[a]?|nyskick|toppskick|välvårdad[a]?|väl underhållen|väl omhändertagen|renoveringsbehov)\b/i.exec(
          data.description
        );
      if (adjectiveMatch) data.condition = adjectiveMatch[1].trim();
    }
  }
}
