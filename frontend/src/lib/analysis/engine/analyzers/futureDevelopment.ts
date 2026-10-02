import type { Analyzer } from "./types";

interface NearbyProject {
  type?: string;
  name?: string;
  distanceM?: number | null;
}

/**
 * Planned or ongoing development near the property (construction sites,
 * infrastructure, zoning plans).
 *
 * `attributes.nearby_planned_projects` is set by the Location Intelligence
 * Engine bridge (providers/locationIntelligence.ts) from real OSM
 * construction-site, Trafikverket infrastructure and Lantmäteriet detaljplan
 * data — an array of named nearby projects, possibly empty when the sources
 * were checked and found none. `available` is false only when it was never
 * checked ("not checked" is not the same as "none found").
 */
export const futureDevelopmentAnalyzer: Analyzer = {
  id: "futureDevelopment",

  analyze({ attributes }) {
    const plannedProjects = attributes.nearby_planned_projects;
    if (plannedProjects === undefined) return { id: "futureDevelopment", available: false, supportingData: {} };

    const projects: NearbyProject[] = Array.isArray(plannedProjects) ? plannedProjects : [];
    const supportingData: Record<string, unknown> = { nearbyPlannedProjectsCount: projects.length };
    if (projects.length > 0) {
      supportingData.nearbyPlannedProjects = projects
        .slice(0, 5)
        .map((p) => p.name)
        .filter(Boolean);
    }
    return { id: "futureDevelopment", available: true, supportingData };
  },
};
