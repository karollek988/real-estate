/**
 * Primary extraction source: Hemnet's embedded Next.js application state.
 *
 * Hemnet server-renders `<script id="__NEXT_DATA__">` containing
 * `props.pageProps.__APOLLO_STATE__` — the normalized Apollo GraphQL cache
 * the page hydrates from. This is Hemnet's own structured data for the
 * listing (not a public API, but not incidental either): every fact panel,
 * price, amenity, and broker detail visible on the page is a value in this
 * object, addressed by a stable field name. Verified against real listing
 * pages (apartment resale, new-construction unit, and villa) as of 2026-07:
 * the fact panel, amenities, and description are *only* present here — they
 * are rendered client-side from this state and never appear as static HTML,
 * so an HTML/regex-only parser structurally cannot see them.
 *
 * The cache is flat and keyed `"<Type>:<id>"`, with cross-entity links
 * represented as `{ __ref: "<Type>:<id>" }`. This module finds the listing
 * entity, then resolves every ref it needs (broker, agency, BRF, municipality)
 * against the same cache.
 */
import { emptyHemnetPageData, type HemnetPageData } from "./types.ts";
import { moneyAmount, parseAreaString, readParamField, resolveRef } from "./utils.ts";

/** Amenity `kind` values that map onto a dedicated boolean field on HemnetPageData. */
const AMENITY_KIND_SETTER: Record<string, (data: HemnetPageData, value: boolean) => void> = {
  BALCONY: (d, v) => (d.balcony = v),
  ELEVATOR: (d, v) => (d.elevator = v),
  PATIO: (d, v) => (d.patio = v),
  PARKING: (d, v) => (d.parking = v),
  GARAGE: (d, v) => (d.garage = v),
  STORAGE: (d, v) => (d.storage = v),
  FIREPLACE: (d, v) => (d.fireplace = v),
};

/**
 * Listing entity `__typename`s seen on real pages, in preference order.
 * `ActivePropertyListing` covers ordinary resale listings; `ProjectUnit`
 * covers new-construction units, which carry the same field set.
 */
const LISTING_TYPES = ["ActivePropertyListing", "ProjectUnit"];

export function extractApollo(html: string): HemnetPageData {
  const data = emptyHemnetPageData();

  const nextDataMatch = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!nextDataMatch) return data;

  let nextData: unknown;
  try {
    nextData = JSON.parse(nextDataMatch[1]);
  } catch {
    return data;
  }

  const apolloState = getIn(nextData, ["props", "pageProps", "__APOLLO_STATE__"]);
  if (!apolloState || typeof apolloState !== "object") return data;
  const apollo = apolloState as Record<string, unknown>;

  const listing = findListingEntity(apollo);
  if (!listing) return data;

  populateFromListing(data, apollo, listing);
  return data;
}

function findListingEntity(apollo: Record<string, unknown>): Record<string, unknown> | null {
  for (const type of LISTING_TYPES) {
    const key = Object.keys(apollo).find((k) => k.startsWith(`${type}:`));
    if (key) return apollo[key] as Record<string, unknown>;
  }
  // Structural fallback in case Hemnet renames the type: any cache entry that
  // looks like a listing (has a price and an address/canonical URL) is close
  // enough to try, since every field read below is independently guarded.
  for (const value of Object.values(apollo)) {
    if (
      value &&
      typeof value === "object" &&
      "askingPrice" in value &&
      ("streetAddress" in value || "listingHemnetUrl" in value)
    ) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function populateFromListing(
  data: HemnetPageData,
  apollo: Record<string, unknown>,
  listing: Record<string, unknown>
): void {
  if (typeof listing.streetAddress === "string" && listing.streetAddress.trim()) {
    data.street_address = listing.streetAddress.trim();
  }

  data.asking_price_sek = moneyAmount(listing.askingPrice);
  data.price_per_m2_sek = moneyAmount(listing.squareMeterPrice);
  data.monthly_fee_sek = moneyAmount(listing.fee);
  data.operating_costs_sek = moneyAmount(listing.runningCosts);

  data.living_area_m2 =
    typeof listing.livingArea === "number" ? listing.livingArea : parseAreaString(listing.formattedLivingArea);
  data.additional_area_m2 =
    typeof listing.supplementalArea === "number"
      ? listing.supplementalArea
      : parseAreaString(listing.formattedSupplementalArea);
  data.lot_area_m2 =
    typeof listing.landArea === "number" ? listing.landArea : parseAreaString(listing.formattedLandArea);

  if (typeof listing.legacyConstructionYear === "string" || typeof listing.legacyConstructionYear === "number") {
    const year = parseInt(String(listing.legacyConstructionYear), 10);
    if (Number.isFinite(year) && year > 1700 && year < 2100) {
      data.building_year = year;
      data.construction_year = year;
    }
  }

  const energyClassification = listing.energyClassification as Record<string, unknown> | undefined;
  if (energyClassification && typeof energyClassification.classification === "string") {
    data.energy_class = energyClassification.classification;
  }

  if (typeof listing.description === "string" && listing.description.trim()) {
    data.description = listing.description.trim();
  }

  if (typeof listing.numberOfRooms === "number") {
    data.rooms = listing.numberOfRooms;
  }

  if (typeof listing.formattedFloor === "string" && listing.formattedFloor.trim()) {
    data.floor = listing.formattedFloor.trim();
  }

  const housingForm = listing.housingForm as Record<string, unknown> | undefined;
  if (housingForm && typeof housingForm.name === "string") {
    data.property_type = housingForm.name;
  }

  const tenure = listing.tenure as Record<string, unknown> | undefined;
  if (tenure && typeof tenure.name === "string") {
    data.ownership_type = tenure.name;
  }

  if (typeof listing.publishedAt === "string" || typeof listing.publishedAt === "number") {
    const seconds = parseFloat(String(listing.publishedAt));
    if (Number.isFinite(seconds) && seconds > 0) {
      data.listing_date = new Date(seconds * 1000).toISOString();
    }
  }

  if (typeof listing.id === "string" || typeof listing.id === "number") {
    data.object_id = String(listing.id);
  }

  const broker = resolveRef(apollo, listing.broker);
  if (broker && typeof broker.name === "string") data.broker = broker.name;

  const brokerAgency = resolveRef(apollo, listing.brokerAgency);
  if (brokerAgency && typeof brokerAgency.name === "string") data.agency = brokerAgency.name;

  const brf = resolveRef(apollo, listing.brf);
  if (brf && typeof brf.name === "string") {
    data.housing_association = brf.name;
  } else if (typeof listing.housingCooperative === "string" && listing.housingCooperative.trim()) {
    data.housing_association = listing.housingCooperative;
  }

  // Apollo has no dedicated `condition` field (verified on real listings,
  // 2026-07), but `isNewConstruction` is an explicit boolean the listing
  // entity does carry, and "Nyproduktion" is itself a standard Swedish
  // condition descriptor for a never-lived-in unit.
  if (listing.isNewConstruction === true) {
    data.condition = "Nyproduktion";
    data.new_construction = true;
  } else if (listing.isNewConstruction === false) {
    data.new_construction = false;
  }

  populateAmenities(data, listing);
  populateImages(data, listing);
}

/**
 * `relevantAmenities` is the authoritative source (it states explicit
 * `isAvailable: false`, not just absence). `labels` is a second, independently
 * populated Apollo array — the chips Hemnet renders on the listing itself —
 * that occasionally carries a feature `relevantAmenities` omits entirely
 * (e.g. "Inflyttningsklar"/move-in-ready has no Amenity representation at
 * all). It only fills gaps: it never overrides a boolean relevantAmenities
 * already set, since a label's mere presence only signals "true", never
 * "false".
 */
function populateAmenities(data: HemnetPageData, listing: Record<string, unknown>): void {
  const amenities = listing.relevantAmenities;
  if (Array.isArray(amenities)) {
    for (const amenity of amenities) {
      if (!amenity || typeof amenity !== "object") continue;
      const kind = (amenity as Record<string, unknown>).kind;
      const isAvailable = (amenity as Record<string, unknown>).isAvailable;
      const title = (amenity as Record<string, unknown>).title;
      if (typeof kind !== "string" || typeof isAvailable !== "boolean") continue;

      const setter = AMENITY_KIND_SETTER[kind];
      if (setter) {
        setter(data, isAvailable);
      } else if (isAvailable && typeof title === "string" && title.trim()) {
        // An amenity kind we don't track as its own boolean (e.g. fireplace) —
        // surface it in the free-form features list instead of dropping it.
        data.features.push(title.trim());
      }
    }
  }

  const labels = listing.labels;
  if (Array.isArray(labels)) {
    for (const label of labels) {
      if (!label || typeof label !== "object") continue;
      const { category, identifier, text } = label as Record<string, unknown>;
      if (category !== "FEATURE" || typeof identifier !== "string") continue;

      const setter = AMENITY_KIND_SETTER[identifier];
      if (setter) {
        if (data[boolFieldForKind(identifier)] === null) setter(data, true);
      } else if (typeof text === "string" && text.trim()) {
        data.features.push(text.trim());
      }
    }
  }
}

function boolFieldForKind(kind: string): keyof HemnetPageData {
  const map: Record<string, keyof HemnetPageData> = {
    BALCONY: "balcony",
    ELEVATOR: "elevator",
    PATIO: "patio",
    PARKING: "parking",
    GARAGE: "garage",
    STORAGE: "storage",
    FIREPLACE: "fireplace",
  };
  return map[kind];
}

function populateImages(data: HemnetPageData, listing: Record<string, unknown>): void {
  // The main `images(...)` gallery is the only place these entities carry an
  // actual `url(...)` — the separate `floorPlanImages` field below points at
  // the same underlying photos but (verified on real listings, 2026-07) is
  // queried without the `url(...)` argument, so its entries always resolve to
  // `undefined`. Gallery items self-report which ones are floor plans via
  // `labels: ["FLOOR_PLAN"]`; route those into floorplan_urls instead of the
  // photo gallery so floor plan diagrams don't pollute image_urls.
  const imagesField = readParamField(listing, "images") as Record<string, unknown> | undefined;
  const images = imagesField?.images;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (!image || typeof image !== "object") continue;
      const url = readParamField(image as Record<string, unknown>, "url");
      if (typeof url !== "string" || !url.startsWith("http")) continue;

      const labels = (image as Record<string, unknown>).labels;
      if (Array.isArray(labels) && labels.includes("FLOOR_PLAN")) {
        data.floorplan_urls.push(url);
      } else {
        data.image_urls.push(url);
      }
    }
  }

  if (data.image_urls.length === 0) {
    const thumbnail = listing.thumbnail as Record<string, unknown> | undefined;
    const url = thumbnail ? readParamField(thumbnail, "url") : undefined;
    if (typeof url === "string" && url.startsWith("http")) {
      data.image_urls.push(url);
    }
  }

  // Fallback in case a future listing variant does populate url() here.
  const floorPlanImages = listing.floorPlanImages;
  if (Array.isArray(floorPlanImages)) {
    for (const image of floorPlanImages) {
      if (!image || typeof image !== "object") continue;
      const url = readParamField(image as Record<string, unknown>, "url");
      if (typeof url === "string" && url.startsWith("http")) {
        data.floorplan_urls.push(url);
      }
    }
  }
}

function getIn(obj: unknown, path: string[]): unknown {
  let current = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
