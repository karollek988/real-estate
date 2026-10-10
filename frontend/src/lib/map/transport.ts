import type { MapTransport, MapTransportStop } from "./types";

/**
 * The lite area analysis of a map listing: the nearest bus stop and the nearest train station.
 *
 * The source is Transitous (https://transitous.org), the open-source MOTIS journey planner run by the community, with
 * the stops of Trafiklab (CC0) and other public feeds. It needs no key. Its endpoint for "all stops in a box" says,
 * for every stop, which kinds of traffic call there (BUS, REGIONAL_RAIL, LONG_DISTANCE...). Chosen over OpenStreetMap's
 * Overpass, which answered only 6 of 11 test calls (rate limited), and over ResRobot, which needs a key.
 *
 * Facts only (product rule 1): a name and a straight-line distance. A stop that is not within the search distance is
 * reported as missing, never guessed. Transitous has no service level, so the result is stored with the listing and
 * a listing is looked up once (lib/map/transportJob.ts).
 *
 * The parts that decide (parseStops, pickNearest) are pure; transport.verify.mjs checks them without a network.
 */

const STOPS_URL = "https://api.transitous.org/api/v1/map/stops";
/** First the near surroundings, then the wider area if a kind of stop was not found. */
export const SEARCH_RADII_M = [2_500, 12_000] as const;
const REQUEST_TIMEOUT_MS = 8_000;
/** Transitous asks its users to say who they are. */
const USER_AGENT = "Kopanalys/1.0 (https://kopanalys.se; kontakt@kopanalys.se)";

const BUS_MODES = new Set(["BUS"]);
/** Everything on rails that is not metro or tram: local and regional trains, long-distance and night trains. */
const TRAIN_MODES = new Set(["RAIL", "HIGHSPEED_RAIL", "LONG_DISTANCE", "NIGHT_RAIL", "REGIONAL_FAST_RAIL", "REGIONAL_RAIL", "SUBURBAN"]);

export interface Stop {
  name: string;
  lat: number;
  lon: number;
  modes: string[];
}

/** Metres between two points on the earth (haversine). */
export function distanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The stops of a Transitous answer; anything that is not a named stop with a position is left out. */
export function parseStops(body: unknown): Stop[] {
  if (!Array.isArray(body)) return [];
  const stops: Stop[] = [];
  for (const item of body) {
    if (!item || typeof item !== "object") continue;
    const { name, lat, lon, modes } = item as Record<string, unknown>;
    if (typeof name !== "string" || name.trim() === "" || typeof lat !== "number" || typeof lon !== "number") continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    stops.push({
      name: name.trim().slice(0, 100),
      lat,
      lon,
      modes: Array.isArray(modes) ? modes.filter((mode): mode is string => typeof mode === "string") : [],
    });
  }
  return stops;
}

function nearest(stops: Stop[], wanted: Set<string>, lat: number, lng: number, withinM: number): MapTransportStop | null {
  let best: { stop: Stop; d: number } | null = null;
  for (const stop of stops) {
    if (!stop.modes.some((mode) => wanted.has(mode))) continue;
    const d = distanceMetres(lat, lng, stop.lat, stop.lon);
    if (d > withinM) continue; // the search box has corners that reach further than the radius
    if (!best || d < best.d) best = { stop, d };
  }
  return best ? { name: best.stop.name, distanceM: Math.max(10, Math.round(best.d / 10) * 10) } : null;
}

/** The nearest bus stop and the nearest train station among `stops`, within `withinM` metres of the point. */
export function pickNearest(stops: Stop[], lat: number, lng: number, withinM: number): { bus: MapTransportStop | null; train: MapTransportStop | null } {
  return { bus: nearest(stops, BUS_MODES, lat, lng, withinM), train: nearest(stops, TRAIN_MODES, lat, lng, withinM) };
}

/** The box of "min" and "max" corners that Transitous takes: about `radiusM` metres in every direction. */
export function boundingBox(lat: number, lng: number, radiusM: number): { min: string; max: string } {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { min: `${(lat - dLat).toFixed(5)},${(lng - dLng).toFixed(5)}`, max: `${(lat + dLat).toFixed(5)},${(lng + dLng).toFixed(5)}` };
}

type Fetch = typeof fetch;

/** The stops in the box. Throws when Transitous cannot be reached or answers an error: the caller tries again later. */
export async function fetchStops(lat: number, lng: number, radiusM: number, fetchImpl: Fetch = fetch): Promise<Stop[]> {
  const { min, max } = boundingBox(lat, lng, radiusM);
  const response = await fetchImpl(`${STOPS_URL}?min=${min}&max=${max}`, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Transitous answered ${response.status}`);
  return parseStops(await response.json());
}

/**
 * The transport info of a place. Looks within the first radius, and within the wider one only for what was not found.
 * If any call fails the whole thing fails (and is tried again later): a half answer would say "no train" when there
 * only was no answer.
 */
export async function generateTransport(lat: number, lng: number, fetchImpl: Fetch = fetch, now: () => Date = () => new Date()): Promise<MapTransport> {
  let bus: MapTransportStop | null = null;
  let train: MapTransportStop | null = null;
  let searched: number = SEARCH_RADII_M[0];
  for (const radiusM of SEARCH_RADII_M) {
    const stops = await fetchStops(lat, lng, radiusM, fetchImpl);
    const found = pickNearest(stops, lat, lng, radiusM);
    bus = bus ?? found.bus;
    train = train ?? found.train;
    searched = radiusM;
    if (bus && train) break;
  }
  return { bus, train, searchedWithinM: searched, source: "transitous", fetchedAt: now().toISOString() };
}
