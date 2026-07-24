import type { DataProvider } from "./types";

/**
 * Placeholder providers: planned data sources that are NOT connected yet.
 *
 * They are registered so every analysis honestly records which sources the
 * report is still missing (status "not_connected" in data_sources), and so
 * connecting a real source later is a drop-in replacement: implement
 * DataProvider in its own module, register it, remove the placeholder here.
 */
function notConnected(id: string, name: string, detail: string): DataProvider {
  return {
    id,
    name,
    kind: "placeholder",
    async collect() {
      return {
        source: { id, name, kind: "placeholder" as const, status: "not_connected" as const, fields: [], detail },
        data: {},
      };
    },
  };
}

export const placeholderProviders: DataProvider[] = [
  notConnected(
    "lantmateriet_address",
    "Address & parcel registry (Lantmäteriet)",
    "Canonical address, apartment register and parcel data — planned integration (API key required)."
  ),
  notConnected(
    "municipality_plans",
    "Municipality planning documents",
    "Detaljplaner and building permits near the property — no unified national API exists (fragmented per-municipality, docs/data-source-inventory.md entry 7); Stockholm's own open-data portal was unreachable when checked (2026-07-16)."
  ),
  notConnected(
    "brf_register",
    "BRF information (allabrf/registry)",
    "Association size, byggår and management data — same organisationsnummer blocker as brf_financials above."
  ),
  notConnected(
    "crime_statistics",
    "Crime statistics (BRÅ/Polisen)",
    "Reported-crime levels for the area — BRÅ publishes only static downloadable tables, no query API (verified 2026-07-16, no api.bra.se or similar exists)."
  ),
  notConnected(
    "school_ratings",
    "School quality (Skolverket)",
    "Results and ratings for nearby schools — planned integration (OpenStreetMap covers school presence/count, not quality ratings)."
  ),
  notConnected(
    "public_transport",
    "Public transport (Trafiklab)",
    "Realtime transit journey planning — planned integration (OpenStreetMap covers stop presence/count, not schedules or journey times)."
  ),
  notConnected(
    "environmental_data",
    "Environmental risk data",
    "Flood risk, noise and air quality — planned integration (SMHI's open weather API doesn't cover these; would need SMHI Vattenwebb/MSB flood maps, a separate geodata service)."
  ),
];
