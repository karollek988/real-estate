import type { Analyzer } from "./types";
import { clamp, insufficientDataFactor, sourceLabel } from "../helpers";

const ID = "futureDevelopment";
const LABEL = "Future Potential";
const WEIGHT = 0.10;

interface NearbyProject {
  type?: string;
  name?: string;
  distanceM?: number | null;
}

/**
 * Future Development Analyzer — planned infrastructure/zoning changes that
 * could affect future value.
 *
 * Real today: `attributes.nearby_planned_projects` is set by the Location
 * Intelligence Engine bridge (providers/locationIntelligence.ts) from real
 * OSM construction-site, Trafikverket infrastructure, and Lantmäteriet
 * detaljplan data — an array of named nearby projects (possibly empty if
 * the sources were checked and found none).
 */
export const futureDevelopmentAnalyzer: Analyzer = {
  id: ID,
  label: LABEL,
  weight: WEIGHT,

  analyze({ attributes, dataSources }) {
    const plannedProjects = attributes.nearby_planned_projects;

    if (plannedProjects === undefined) {
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: 0.05,
        status: "No planning data",
        explanation:
          "No municipality planning or infrastructure project data is connected yet, so future potential can't be evaluated.",
        missingData: [
          sourceLabel(dataSources, "municipality_plans"),
          sourceLabel(dataSources, "infrastructure_projects"),
        ],
      });
    }

    const projects: NearbyProject[] = Array.isArray(plannedProjects) ? plannedProjects : [];
    const count = projects.length;

    // Design constant: each nearby planned/active project (construction,
    // infrastructure, or zoning) nudges the score up from a neutral 50 —
    // visible development activity is treated as upside potential, not a
    // risk — capped at 100. Not derived from data; tunable without
    // touching the rest of the engine.
    const score = Math.round(clamp(50 + count * 4, 0, 100));
    const status =
      count === 0 ? "No planned projects found nearby" : count <= 2 ? "Some development nearby" : "Active development nearby";

    const supportingData: Record<string, unknown> = { nearbyPlannedProjectsCount: count };
    if (count > 0) {
      supportingData.nearbyPlannedProjects = projects.slice(0, 5).map((p) => p.name).filter(Boolean);
    }

    return {
      id: ID,
      label: LABEL,
      weight: WEIGHT,
      score,
      confidence: 0.5,
      status,
      explanation:
        count > 0
          ? `${count} planned or active development project${count === 1 ? "" : "s"} found near this property (construction sites, infrastructure, or zoning plans).`
          : "No planned or active development projects were found near this property in the connected sources.",
      supportingData,
      missingData: [],
    };
  },
};
