import type { DataProvider, ProviderResult } from "./types";
import { pythonEngineHeaders } from "@/lib/pythonEngine";

/**
 * Bridges the standalone `location_intelligence` Python package (built and
 * tested, but never called from any live request path — see
 * docs/44_production_release_checklist.md, B6) into the live analysis
 * pipeline via the FastAPI service in api/server.py.
 *
 * That package collects up to 12 findings domains (construction,
 * infrastructure, planning, schools, crime, municipality, companies,
 * news, ...). This provider lifts out:
 * - the "nearby development" signal (`futureDevelopment.ts`'s
 *   `attributes.nearby_planned_projects`) from construction/infrastructure/
 *   planning's `_nearest` findings, plus the `schools` domain's
 *   `planned_schools` finding (Skolverket's Status=Planerad school units —
 *   same "real future-value signal" shape as a planned road or detaljplan);
 * - the `crime` domain's Polisen event count (`attributes.area_recent_police_events`)
 *   — county-level, real, honestly labeled as an incident *log*, not a
 *   crime *rate* (see polisen_crime.py's own docstring on this distinction);
 * - the `municipality` domain's Kolada KPIs relevant to safety/civic life
 *   (`attributes.area_safety_index`, `.area_voter_turnout_pct`) — kommun-level,
 *   `REGISTRY_AUTHORITY` trust tier, already collected on every request this
 *   provider makes; previously discarded entirely.
 *
 * The rest of the package's findings (poi counts/nearest, companies, news,
 * most other Kolada KPIs) remain real but not yet consumed by any analyzer —
 * same "forward contract, no fabrication" model the rest of this pipeline
 * already uses.
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

/** Polisen's rolling recent-event count (`crime` domain) — a county-level incident log, not a crime rate. */
function extractPoliceEventCount(pkg: LIPackage): number | null {
  for (const provider of pkg.providers ?? []) {
    for (const finding of provider.findings ?? []) {
      if (finding.domain === "crime" && finding.key?.startsWith("police_event_count_last_")) {
        return typeof finding.value === "number" ? finding.value : null;
      }
    }
  }
  return null;
}

/** A single Kolada KPI value from the `municipality` domain, matched by its `key` (see location_intelligence/providers/kolada.py's KPIS table). */
function extractKoladaKpi(pkg: LIPackage, key: string): number | null {
  for (const provider of pkg.providers ?? []) {
    for (const finding of provider.findings ?? []) {
      if (finding.domain === "municipality" && finding.key === key) {
        return typeof finding.value === "number" ? finding.value : null;
      }
    }
  }
  return null;
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
        headers: pythonEngineHeaders(),
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
    const policeEventCount = extractPoliceEventCount(body.package);
    const safetyIndex = extractKoladaKpi(body.package, "safety_security_index");
    const voterTurnoutPct = extractKoladaKpi(body.package, "voter_turnout_pct");

    const data: Record<string, unknown> = {};
    const fields: string[] = [];
    if (anyChecked) {
      data.nearby_planned_projects = projects;
      fields.push("nearby_planned_projects");
    }
    if (policeEventCount !== null) {
      data.area_recent_police_events = policeEventCount;
      fields.push("area_recent_police_events");
    }
    if (safetyIndex !== null) {
      data.area_safety_index = safetyIndex;
      fields.push("area_safety_index");
    }
    if (voterTurnoutPct !== null) {
      data.area_voter_turnout_pct = voterTurnoutPct;
      fields.push("area_voter_turnout_pct");
    }

    if (fields.length === 0) {
      return { source: { ...base, status: "no_data", fields: [], detail: "No location-intelligence providers returned data for this location." }, data: {} };
    }

    return { source: { ...base, status: "ok", fields }, data };
  },
};
