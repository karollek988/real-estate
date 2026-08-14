import type { DataProvider, ProviderResult } from "./types";
import { fetchJson } from "./httpJson";

/**
 * Real provider: commute times to the nearest "centrum" and, when the
 * property isn't already in one, to the relevant major city — car (OSRM),
 * public transit (Trafiklab ResRobot), and walking (OSRM, centrum only).
 *
 * ResRobot (https://www.trafiklab.se/api/our-apis/resrobot-v21/) is
 * Trafiklab's free, CC0-licensed journey planner covering all Swedish
 * public transit (SL, Västtrafik, Skånetrafiken, ...) under one key — no
 * per-region integration needed. Requires a free account/API key:
 * TRAFIKLAB_RESROBOT_API_KEY. Without it this provider reports
 * "not_connected", same pattern as booli.ts without BOOLI_API_KEY.
 *
 * OSRM (https://router.project-osrm.org) is free/keyless but its public
 * demo server explicitly has no uptime SLA and a 1 req/s usage policy
 * ("restricted to reasonable, non-commercial use") — fine for now, should
 * be swapped for a self-hosted or paid routing provider before launch.
 */

const RESROBOT_BASE = "https://api.resrobot.se/v2.1";
const OSRM_BASE = "https://router.project-osrm.org/route/v1";
const USER_AGENT = "Kopanalys/0.1 (property decision support; contact: karollek98@gmail.com)";

const MAJOR_CITIES = new Set(["Stockholm", "Göteborg", "Malmö"]);

/**
 * Sweden's 21 län (counties) → the commute-relevant major city + a search
 * term for its central station. Static and stable — a best-effort mapping,
 * not always the formal "residensstad" (e.g. Sundsvall over Härnösand for
 * Västernorrland): picks whichever city is actually the meaningful commute
 * destination. Keyed on Nominatim's `address.state` value for SE addresses.
 */
const COUNTY_MAJOR_CITY: Record<string, { city: string; stationQuery: string }> = {
  "Stockholms län": { city: "Stockholm", stationQuery: "Stockholm Centralstation" },
  "Uppsala län": { city: "Uppsala", stationQuery: "Uppsala C" },
  "Södermanlands län": { city: "Nyköping", stationQuery: "Nyköping C" },
  "Östergötlands län": { city: "Linköping", stationQuery: "Linköping C" },
  "Jönköpings län": { city: "Jönköping", stationQuery: "Jönköping C" },
  "Kronobergs län": { city: "Växjö", stationQuery: "Växjö C" },
  "Kalmar län": { city: "Kalmar", stationQuery: "Kalmar C" },
  "Gotlands län": { city: "Visby", stationQuery: "Visby" },
  "Blekinge län": { city: "Karlskrona", stationQuery: "Karlskrona C" },
  "Skåne län": { city: "Malmö", stationQuery: "Malmö Centralstation" },
  "Hallands län": { city: "Halmstad", stationQuery: "Halmstad C" },
  "Västra Götalands län": { city: "Göteborg", stationQuery: "Göteborg Centralstation" },
  "Värmlands län": { city: "Karlstad", stationQuery: "Karlstad C" },
  "Örebro län": { city: "Örebro", stationQuery: "Örebro C" },
  "Västmanlands län": { city: "Västerås", stationQuery: "Västerås C" },
  "Dalarnas län": { city: "Falun", stationQuery: "Falun C" },
  "Gävleborgs län": { city: "Gävle", stationQuery: "Gävle C" },
  "Västernorrlands län": { city: "Sundsvall", stationQuery: "Sundsvall C" },
  "Jämtlands län": { city: "Östersund", stationQuery: "Östersund C" },
  "Västerbottens län": { city: "Umeå", stationQuery: "Umeå C" },
  "Norrbottens län": { city: "Luleå", stationQuery: "Luleå C" },
};

interface StopLocation {
  extId: string;
  name: string;
  lon: number;
  lat: number;
  weight?: number;
}

async function lookupStop(query: string, accessId: string): Promise<StopLocation | null> {
  const params = new URLSearchParams({ input: query, accessId, format: "json", maxNo: "5" });
  const res = await fetchJson<{ stopLocationOrCoordLocation?: Array<{ StopLocation?: StopLocation }> }>(
    `${RESROBOT_BASE}/location.name?${params}`,
    { headers: { "User-Agent": USER_AGENT } },
    8000
  );
  if (!res.ok) return null;
  const candidates = (res.data.stopLocationOrCoordLocation ?? [])
    .map((c) => c.StopLocation)
    .filter((s): s is StopLocation => !!s);
  if (candidates.length === 0) return null;
  // Highest weight = the most significant stop for that name (station size/importance).
  candidates.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  return candidates[0];
}

/** ISO 8601 duration ("PT1H14M", "PT47M") → whole minutes. */
function isoDurationToMinutes(iso: string): number | null {
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const total = days * 1440 + hours * 60 + minutes;
  return total > 0 ? total : null;
}

async function transitMinutes(
  originLat: number,
  originLon: number,
  destStopId: string,
  accessId: string
): Promise<number | null> {
  const params = new URLSearchParams({
    originCoordLat: String(originLat),
    originCoordLong: String(originLon),
    destId: destStopId,
    accessId,
    format: "json",
    numF: "1",
  });
  const res = await fetchJson<{ Trip?: Array<{ duration?: string }> }>(
    `${RESROBOT_BASE}/trip?${params}`,
    { headers: { "User-Agent": USER_AGENT } },
    10000
  );
  if (!res.ok) return null;
  const duration = res.data.Trip?.[0]?.duration;
  return duration ? isoDurationToMinutes(duration) : null;
}

async function osrmMinutes(
  profile: "driving" | "foot",
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): Promise<number | null> {
  const url = `${OSRM_BASE}/${profile}/${originLon},${originLat};${destLon},${destLat}?overview=false`;
  const res = await fetchJson<{ routes?: Array<{ duration?: number }> }>(url, {}, 10000);
  if (!res.ok) return null;
  const seconds = res.data.routes?.[0]?.duration;
  return typeof seconds === "number" && Number.isFinite(seconds) ? Math.round(seconds / 60) : null;
}

export const commuteProvider: DataProvider = {
  id: "commute_times",
  name: "Commute times (Trafiklab ResRobot + OSRM)",
  kind: "real",
  timeoutMs: 20000,

  async collect({ property }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;
    const accessId = process.env.TRAFIKLAB_RESROBOT_API_KEY;

    if (!accessId) {
      return {
        source: { ...base, status: "not_connected", fields: [], detail: "TRAFIKLAB_RESROBOT_API_KEY not set." },
        data: {},
      };
    }
    if (property.latitude === null || property.longitude === null) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "Property has no coordinates yet (geocoding required first)." },
        data: {},
      };
    }

    const origin = { lat: property.latitude, lon: property.longitude };
    const municipality = property.municipality;
    const county = typeof property.attributes.geocoded_county === "string" ? property.attributes.geocoded_county : null;

    const data: Record<string, unknown> = {};
    const fields: string[] = [];

    if (municipality) {
      const centrumStop =
        (await lookupStop(`${municipality} C`, accessId)) ??
        (await lookupStop(`${municipality} Centrum`, accessId)) ??
        (await lookupStop(municipality, accessId));

      if (centrumStop) {
        data.commute_centrum_name = centrumStop.name;
        fields.push("commute_centrum_name");
        const [transit, car, walk] = await Promise.all([
          transitMinutes(origin.lat, origin.lon, centrumStop.extId, accessId),
          osrmMinutes("driving", origin.lat, origin.lon, centrumStop.lat, centrumStop.lon),
          osrmMinutes("foot", origin.lat, origin.lon, centrumStop.lat, centrumStop.lon),
        ]);
        if (transit !== null) {
          data.commute_centrum_transit_minutes = transit;
          fields.push("commute_centrum_transit_minutes");
        }
        if (car !== null) {
          data.commute_centrum_car_minutes = car;
          fields.push("commute_centrum_car_minutes");
        }
        if (walk !== null) {
          data.commute_centrum_walk_minutes = walk;
          fields.push("commute_centrum_walk_minutes");
        }
      }
    }

    if (county && municipality && !MAJOR_CITIES.has(municipality)) {
      const entry = COUNTY_MAJOR_CITY[county];
      if (entry) {
        const cityStop = await lookupStop(entry.stationQuery, accessId);
        if (cityStop) {
          data.commute_city_name = entry.city;
          fields.push("commute_city_name");
          const [transit, car] = await Promise.all([
            transitMinutes(origin.lat, origin.lon, cityStop.extId, accessId),
            osrmMinutes("driving", origin.lat, origin.lon, cityStop.lat, cityStop.lon),
          ]);
          if (transit !== null) {
            data.commute_city_transit_minutes = transit;
            fields.push("commute_city_transit_minutes");
          }
          if (car !== null) {
            data.commute_city_car_minutes = car;
            fields.push("commute_city_car_minutes");
          }
        }
      }
    }

    if (fields.length === 0) {
      return { source: { ...base, status: "no_data", fields: [], detail: "No commute data could be resolved." }, data: {} };
    }
    return { source: { ...base, status: "ok", fields }, data };
  },
};
