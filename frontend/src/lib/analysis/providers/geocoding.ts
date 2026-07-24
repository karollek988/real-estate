import type { DataProvider, ProviderResult } from "./types";

/**
 * Real provider: geocodes the address via OpenStreetMap Nominatim (free, no
 * API key; requires an identifying User-Agent and light usage per
 * https://operations.osmfoundation.org/policies/nominatim/).
 *
 * Interim solution until the Lantmäteriet address registry is connected —
 * that placeholder provider stays registered separately so the swap is
 * visible in every analysis's data_sources.
 */

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Kopanalys/0.1 (property decision support; contact: karollek98@gmail.com)";

interface NominatimHit {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  address?: Record<string, string>;
}

export const nominatimGeocoder: DataProvider = {
  id: "nominatim_geocoding",
  name: "Address geocoding (OpenStreetMap Nominatim)",
  kind: "real",

  async collect({ extracted }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;
    const query = [extracted.address, extracted.municipality ?? "", "Sverige"]
      .filter(Boolean)
      .join(", ");

    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      countrycodes: "se",
      addressdetails: "1",
    });

    const res = await fetch(`${NOMINATIM_ENDPOINT}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        source: { ...base, status: "error", fields: [], detail: `Nominatim responded ${res.status}` },
        data: {},
      };
    }

    const hits = (await res.json()) as NominatimHit[];
    if (!Array.isArray(hits) || hits.length === 0) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: `No match for "${query}"` },
        data: {},
      };
    }

    const hit = hits[0];
    const addr = hit.address ?? {};
    const municipality =
      addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null;

    return {
      source: {
        ...base,
        status: "ok",
        fields: [
          "latitude",
          "longitude",
          ...(municipality ? ["municipality"] : []),
          ...(addr.postcode ? ["postal_code"] : []),
        ],
      },
      data: {
        geocoded_display_name: hit.display_name,
        geocoded_result_type: hit.type ?? null,
      },
      propertyPatch: {
        latitude: Number.parseFloat(hit.lat),
        longitude: Number.parseFloat(hit.lon),
        ...(municipality ? { municipality } : {}),
        ...(addr.postcode ? { postalCode: addr.postcode } : {}),
      },
    };
  },
};
