import type { DataProvider, ProviderResult } from "./types";

/**
 * Real provider: Trafikverket Open API v2 — free API key issued on
 * request via data.trafikverket.se (docs/data-source-inventory.md entry
 * 9). Reuses the `infrastructure_projects` id/placeholder from the
 * previous milestone.
 *
 * Confirmed live during development that the endpoint exists and requires
 * authentication (401 "Invalid authentication" without a key) — the same
 * "real but untestable without a key" situation as Booli. Implemented
 * against Trafikverket's documented XML-request/JSON-response v2 API
 * (objecttype "Situation" — active road deviations/roadworks — filtered
 * to a bounding box around the property). Field extraction is defensive;
 * verify against a real response and adjust once TRAFIKVERKET_API_KEY is
 * available — same calibration caveat as booli.ts.
 *
 * Without TRAFIKVERKET_API_KEY configured, reports "not_connected" — never
 * fake data as a fallback.
 */

const ENDPOINT = "https://api.trafikinfo.trafikverket.se/v2/data.json";
const BOUNDING_BOX_DEGREES = 0.02; // ~2km at Swedish latitudes

interface TrafikverketSituation {
  Deviation?: Array<{
    Header?: string;
    Message?: string;
    MessageType?: string;
    StartTime?: string;
    EndTime?: string;
  }>;
}
interface TrafikverketResponse {
  RESPONSE?: {
    RESULT?: Array<{
      Situation?: TrafikverketSituation[];
      ERROR?: { MESSAGE?: string };
    }>;
  };
}

export const trafikverketInfrastructureProvider: DataProvider = {
  id: "infrastructure_projects",
  name: "Infrastructure projects (Trafikverket)",
  kind: "real",

  async collect({ property }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;
    const apiKey = process.env.TRAFIKVERKET_API_KEY;

    if (!apiKey) {
      return {
        source: {
          ...base,
          status: "not_connected",
          fields: [],
          detail: "Trafikverket API key not configured (set TRAFIKVERKET_API_KEY).",
        },
        data: {},
      };
    }

    if (property.latitude === null || property.longitude === null) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "Property has no coordinates yet (geocoding required first)." },
        data: {},
      };
    }

    const minLon = property.longitude - BOUNDING_BOX_DEGREES;
    const maxLon = property.longitude + BOUNDING_BOX_DEGREES;
    const minLat = property.latitude - BOUNDING_BOX_DEGREES;
    const maxLat = property.latitude + BOUNDING_BOX_DEGREES;

    const requestBody = `<REQUEST>
  <LOGIN authenticationkey="${apiKey}"/>
  <QUERY objecttype="Situation" schemaversion="1.5" limit="20">
    <FILTER>
      <WITHIN name="Deviation.Geometry.WGS84" shape="box" value="${minLon} ${minLat}, ${maxLon} ${maxLat}"/>
    </FILTER>
  </QUERY>
</REQUEST>`;

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: requestBody,
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
    } catch (err) {
      return {
        source: { ...base, status: "error", fields: [], detail: `Trafikverket request failed: ${err instanceof Error ? err.message : String(err)}` },
        data: {},
      };
    }

    if (!res.ok) {
      return { source: { ...base, status: "error", fields: [], detail: `Trafikverket responded ${res.status}` }, data: {} };
    }

    let body: TrafikverketResponse;
    try {
      body = (await res.json()) as TrafikverketResponse;
    } catch {
      return { source: { ...base, status: "error", fields: [], detail: "Trafikverket response was not valid JSON" }, data: {} };
    }

    const result = body.RESPONSE?.RESULT?.[0];
    if (result?.ERROR) {
      return { source: { ...base, status: "error", fields: [], detail: result.ERROR.MESSAGE ?? "Trafikverket returned an error" }, data: {} };
    }

    const situations = result?.Situation ?? [];
    const deviations = situations.flatMap((s) => s.Deviation ?? []);

    const data: Record<string, unknown> = { nearby_road_deviations_count: deviations.length };
    const fields = ["nearby_road_deviations_count"];

    if (deviations.length > 0) {
      const summaries = deviations
        .slice(0, 5)
        .map((d) => d.Header ?? d.Message)
        .filter((s): s is string => Boolean(s));
      if (summaries.length > 0) {
        data.nearby_road_deviations = summaries;
        fields.push("nearby_road_deviations");
      }
    }

    return { source: { ...base, status: "ok", fields }, data };
  },
};
