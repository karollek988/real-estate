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
  // crime_statistics and public_transport placeholders retired here — both
  // are now real: crime/safety via locationIntelligence.ts's Polisen/Kolada
  // bridge, public transport via commute.ts's Trafiklab ResRobot
  // integration (added after this file was first written; never used to
  // retire the placeholder at the time).
  notConnected(
    "environmental_data",
    "Environmental risk data",
    "Flood risk, noise and air quality — planned integration (SMHI's open weather API doesn't cover these; would need SMHI Vattenwebb/MSB flood maps, a separate geodata service)."
  ),
];
