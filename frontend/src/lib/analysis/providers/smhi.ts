import type { DataProvider, ProviderResult } from "./types";
import { fetchJson, haversineMeters } from "./httpJson";

/**
 * Real provider: SMHI open data (metobs) — free, keyless
 * (docs/data-source-inventory.md entry 11).
 *
 * Scope, deliberately narrow: finds the nearest active temperature station
 * and its latest reading, as general climate context. Does NOT claim flood
 * risk — SMHI's metobs API is weather observations, not hydrological flood
 * mapping (that's SMHI Vattenwebb/MSB, a separate, more complex geodata
 * service not implemented here). Flood risk is simply never set by this
 * provider, honestly leaving it unavailable rather than approximating it
 * from weather data it doesn't actually measure.
 *
 * New id (not reusing the `environmental_data` placeholder) — that
 * placeholder specifically covers flood/noise/air-quality risk, which this
 * provider does not supply; conflating the two would make a connected
 * source look like it answered a question it didn't.
 */

const PARAMETER = 1; // Lufttemperatur (air temperature), momentary hourly value
const STATION_LIST_ENDPOINT = `https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/${PARAMETER}.json`;

interface SmhiStation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  active: boolean;
}
interface SmhiStationListResponse {
  station: SmhiStation[];
}
interface SmhiObservationValue {
  date: number;
  value: string;
}
interface SmhiLatestDataResponse {
  value: SmhiObservationValue[];
}

export const smhiClimateProvider: DataProvider = {
  id: "smhi_climate",
  name: "Weather & climate context (SMHI)",
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

    const stationsResult = await fetchJson<SmhiStationListResponse>(STATION_LIST_ENDPOINT);
    if (!stationsResult.ok) {
      return { source: { ...base, status: "error", fields: [], detail: stationsResult.error }, data: {} };
    }

    let nearest: SmhiStation | null = null;
    let nearestDistance = Infinity;
    for (const station of stationsResult.data.station) {
      if (!station.active) continue;
      const d = haversineMeters(origin, { lat: station.latitude, lon: station.longitude });
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = station;
      }
    }

    if (!nearest) {
      return { source: { ...base, status: "no_data", fields: [], detail: "No active SMHI temperature station found." }, data: {} };
    }

    const latestResult = await fetchJson<SmhiLatestDataResponse>(
      `https://opendata-download-metobs.smhi.se/api/version/1.0/parameter/${PARAMETER}/station/${nearest.id}/period/latest-hour/data.json`
    );

    const data: Record<string, unknown> = {
      weather_station_name: nearest.name,
      weather_station_distance_m: Math.round(nearestDistance),
    };
    const fields = ["weather_station_name", "weather_station_distance_m"];

    if (latestResult.ok && latestResult.data.value.length > 0) {
      const reading = latestResult.data.value[latestResult.data.value.length - 1];
      const temp = Number.parseFloat(reading.value);
      if (Number.isFinite(temp)) {
        data.current_temperature_c = temp;
        fields.push("current_temperature_c");
      }
    }

    return { source: { ...base, status: "ok", fields }, data };
  },
};
