import type { DataProvider, ProviderResult } from "./types";

/**
 * Bridges the standalone `location_intelligence` Python package (built and
 * tested, but never called from any live request path — see
 * docs/44_production_release_checklist.md, B6) into the live analysis
 * pipeline via the FastAPI service in api/server.py.
 *
 * That package collects up to 12 findings domains (construction,
 * infrastructure, planning, schools, crime, companies, news, ...) — this
 * provider only lifts out the one signal an analyzer already has a forward
 * contract for (`futureDevelopment.ts`'s `attributes.nearby_planned_projects`),
 * from whichever of the four "nearby development" domains actually
 * returned data — construction/infrastructure/planning's `_nearest` findings,
 * plus the `schools` domain's `planned_schools` finding (Skolverket's
 * Status=Planerad school units: a named, dated, located future school —
 * the same "real future-value signal" shape as a planned road or detaljplan,
 * just under a differently-named key). The rest of the package's findings
 * (poi counts/nearest, crime events, municipality stats, companies, news)
 * are real but not yet consumed by any analyzer — same "forward contract,
 * no fabrication" model the rest of this pipeline already uses.
 */

const NEAREST_PROJECT_DOMAINS = new Set(["construction", "infrastructure", "planning"]);

interface LIFinding {
  domain?: string;
  key?: string;
  value?: unknown;
}
interface LIProviderEntry {
  provider_id?: string;
  status?: string;
  findings?: LIFinding[];
}
interface LIPackage {
  providers?: LIProviderEntry[];
}
interface LIResponse {
  success: boolean;
  package?: LIPackage;
  error?: string;
}

interface NearbyProject {
  type: string;
  name: string;
  distanceM: number | null;
}

function extractNearbyProjects(pkg: LIPackage): { projects: NearbyProject[]; anyChecked: boolean } {
  const projects: NearbyProject[] = [];
  let anyChecked = false;

  for (const provider of pkg.providers ?? []) {
    if (!provider.findings) continue;
    for (const finding of provider.findings) {
      // Skolverket's planned-schools list — same shape (named + optional
      // distance_m) as the `_nearest` findings below, under a domain/key
      // that doesn't match that generic pattern, so it's handled first
      // and separately rather than folded into the loop below.
      if (finding.domain === "schools" && finding.key === "planned_school_count") {
        anyChecked = true;
      }
      if (finding.domain === "schools" && finding.key === "planned_schools" && Array.isArray(finding.value)) {
        anyChecked = true;
        for (const entry of finding.value) {
          if (typeof entry !== "object" || entry === null) continue;
          const record = entry as Record<string, unknown>;
          const name = typeof record.name === "string" ? record.name : "Planned school";
          const distanceM = typeof record.distance_m === "number" ? record.distance_m : null;
          projects.push({ type: "school", name, distanceM });
        }
        continue;
      }

      if (!finding.domain || !NEAREST_PROJECT_DOMAINS.has(finding.domain)) continue;
      // A "_count_within_*m" finding is always emitted whenever the
      // provider actually ran (even when it found zero) — that's what
      // distinguishes "we checked and found none" from "we couldn't
      // check." The "_nearest" finding only exists when count > 0, so it
      // must not be the sole signal for "anyChecked".
      if (finding.key?.includes("_count_within_")) {
        anyChecked = true;
      }
      if (!finding.key?.endsWith("_nearest") || !Array.isArray(finding.value)) continue;
      for (const entry of finding.value) {
        if (typeof entry !== "object" || entry === null) continue;
        const record = entry as Record<string, unknown>;
        const name = typeof record.name === "string" ? record.name : finding.domain;
        const distanceM = typeof record.distance_m === "number" ? record.distance_m : null;
        projects.push({ type: finding.domain, name, distanceM });
      }
    }
  }

  return { projects, anyChecked };
}

export const locationIntelligenceProvider: DataProvider = {
  id: "location_intelligence",
  name: "Location Intelligence Engine",
  kind: "real",

  async collect({ property }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;

    if (property.latitude === null || property.longitude === null) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "Property has no coordinates yet (geocoding required first)." },
        data: {},
      };
    }

    const apiBase = process.env.PYTHON_ENGINE_API_URL;
    if (!apiBase) {
      return {
        source: { ...base, status: "not_connected", fields: [], detail: "Python engine API not configured (set PYTHON_ENGINE_API_URL)." },
        data: {},
      };
    }

    let res: Response;
    try {
      res = await fetch(`${apiBase.replace(/\/$/, "")}/api/location-intelligence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: property.latitude, longitude: property.longitude }),
        signal: AbortSignal.timeout(60000),
        cache: "no-store",
      });
    } catch (err) {
      return {
        source: { ...base, status: "error", fields: [], detail: `Location intelligence request failed: ${err instanceof Error ? err.message : String(err)}` },
        data: {},
      };
    }

    if (!res.ok) {
      return { source: { ...base, status: "error", fields: [], detail: `Location intelligence engine responded ${res.status}` }, data: {} };
    }

    let body: LIResponse;
    try {
      body = (await res.json()) as LIResponse;
    } catch {
      return { source: { ...base, status: "error", fields: [], detail: "Location intelligence response was not valid JSON" }, data: {} };
    }

    if (!body.success || !body.package) {
      return { source: { ...base, status: "error", fields: [], detail: body.error ?? "Location intelligence engine returned an error" }, data: {} };
    }

    const { projects, anyChecked } = extractNearbyProjects(body.package);
    if (!anyChecked) {
      return { source: { ...base, status: "no_data", fields: [], detail: "No nearby-development providers returned data for this location." }, data: {} };
    }

    return {
      source: { ...base, status: "ok", fields: ["nearby_planned_projects"] },
      data: { nearby_planned_projects: projects },
    };
  },
};
