import type { DataProvider, ProviderResult } from "./types";
import { fetchJson, haversineMeters } from "./httpJson";

/**
 * Real provider: OpenStreetMap (Overpass API) — free, keyless
 * (docs/data-source-inventory.md entry 8, ODbL — attribution required,
 * already given in the report footer's data-source list). Public Overpass
 * instances are best-effort/rate-limited, so this is one bounded query per
 * analysis with a generous timeout and graceful degradation to "error".
 *
 * Reports an accurate COUNT within a fixed walkable radius per category —
 * deliberately not a "nearest distance in meters", because Overpass doesn't
 * return elements sorted by distance and dense categories (e.g. 500+
 * restaurants in central Stockholm) would force sampling an arbitrary
 * subset to compute one, silently misreporting "nearest" as whatever the
 * server happened to return first. A count is exact; a sampled "nearest"
 * would not be, so this provider only reports what it can back with real
 * precision. The one true single-point distance requested (distance to the
 * city/municipality center) doesn't have this problem — it's one lookup —
 * so that one is real and precise.
 */

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Kopanalys/0.1 (property decision support; contact: karollek98@gmail.com)";
const RADIUS_METERS = 1000;

const CATEGORIES: Array<{ key: string; overpassFilter: string }> = [
  { key: "grocery", overpassFilter: '["shop"="supermarket"]' },
  { key: "school", overpassFilter: '["amenity"="school"]' },
  { key: "restaurant", overpassFilter: '["amenity"="restaurant"]' },
  { key: "park", overpassFilter: '["leisure"="park"]' },
  { key: "transit", overpassFilter: '["public_transport"="stop_position"]' },
  { key: "hospital", overpassFilter: '["amenity"="hospital"]' },
  { key: "highway_major", overpassFilter: '["highway"~"^(motorway|trunk|primary)$"]' },
];

interface OverpassCountTags {
  total: string;
}
interface OverpassCountElement {
  type: "count";
  tags: OverpassCountTags;
}
interface OverpassResponse {
  elements: OverpassCountElement[];
}

function buildQuery(lat: number, lon: number): string {
  const sets = CATEGORIES.map(
    (c) =>
      `(node(around:${RADIUS_METERS},${lat},${lon})${c.overpassFilter};way(around:${RADIUS_METERS},${lat},${lon})${c.overpassFilter};)->.${c.key};`
  ).join("\n");
  const counts = CATEGORIES.map((c) => `.${c.key} out count;`).join("\n");
  return `[out:json][timeout:20];\n${sets}\n${counts}`;
}

export const osmAmenitiesProvider: DataProvider = {
  id: "osm_amenities",
  name: "Nearby amenities & transport (OpenStreetMap)",
  kind: "real",

  async collect({ property }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;

    if (property.latitude === null || property.longitude === null) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "Property has no coordinates yet (geocoding required first)." },
        data: {},
      };
    }
    const origin = { lat: property.latitude, lon: property.longitude };

    const overpassResult = await fetchJson<OverpassResponse>(
      OVERPASS_ENDPOINT,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(buildQuery(origin.lat, origin.lon))}`,
      },
      20000
    );

    const data: Record<string, unknown> = {};
    const fields: string[] = [];

    if (overpassResult.ok) {
      const countBlocks = overpassResult.data.elements.filter((e) => e.type === "count");
      CATEGORIES.forEach((category, i) => {
        const total = countBlocks[i] ? Number.parseInt(countBlocks[i].tags.total, 10) : null;
        if (total === null || !Number.isFinite(total)) return;
        data[`${category.key}_count_within_${RADIUS_METERS}m`] = total;
        fields.push(`${category.key}_count_within_${RADIUS_METERS}m`);
      });
    }

    const municipalityDistance = await distanceToMunicipalityCenter(origin);
    if (municipalityDistance !== null) {
      data.distance_to_city_center_m = municipalityDistance;
      fields.push("distance_to_city_center_m");
    }

    if (fields.length === 0) {
      const detail = !overpassResult.ok ? overpassResult.error : "No amenity or distance data returned.";
      return { source: { ...base, status: "error", fields: [], detail }, data: {} };
    }

    // Overpass counts and the distance lookup are independent calls — report
    // real data whenever either succeeded, but never hide a partial failure:
    // if Overpass itself failed, say so even though `fields` is non-empty.
    const detail = !overpassResult.ok
      ? `Amenity counts unavailable: ${overpassResult.error}`
      : undefined;

    return { source: { ...base, status: "ok", fields, ...(detail ? { detail } : {}) }, data };
  },
};

interface NominatimHit {
  lat: string;
  lon: string;
}

async function distanceToMunicipalityCenter(origin: { lat: number; lon: number }): Promise<number | null> {
  // Caller doesn't have municipality name here by design (keeps this helper
  // property-agnostic); resolved via reverse geocoding the property's own
  // coordinates instead, avoiding a second round-trip through extracted data.
  const reverseParams = new URLSearchParams({
    lat: String(origin.lat),
    lon: String(origin.lon),
    format: "jsonv2",
  });
  const reverse = await fetchJson<{ address?: Record<string, string> }>(
    `https://nominatim.openstreetmap.org/reverse?${reverseParams}`,
    { headers: { "User-Agent": USER_AGENT } },
    8000
  );
  const municipality = reverse.ok
    ? reverse.data.address?.city ?? reverse.data.address?.town ?? reverse.data.address?.municipality
    : null;
  if (!municipality) return null;

  const searchParams = new URLSearchParams({
    q: `${municipality}, Sverige`,
    format: "jsonv2",
    limit: "1",
    countrycodes: "se",
  });
  const search = await fetchJson<NominatimHit[]>(
    `${NOMINATIM_ENDPOINT}?${searchParams}`,
    { headers: { "User-Agent": USER_AGENT } },
    8000
  );
  if (!search.ok || search.data.length === 0) return null;

  const center = { lat: Number.parseFloat(search.data[0].lat), lon: Number.parseFloat(search.data[0].lon) };
  return Math.round(haversineMeters(origin, center));
}
