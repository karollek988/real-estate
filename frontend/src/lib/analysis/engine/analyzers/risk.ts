import type { Analyzer } from "./types";
import { numberOrNull } from "../helpers";

/**
 * Risk facts — the figures the "Möjliga risker" chapter is written from. Each
 * is a plain observation about the building, the interest rate or the area;
 * nothing is weighted, scored or combined into an overall risk level, and a
 * figure that was not collected is simply absent (the chapter then says it
 * could not be assessed).
 *
 * - building year / last renovation -> building age (maintenance)
 * - policy rate (Riksbanken)        -> interest-rate exposure of the association
 * - population growth (SCB)         -> long-term demand
 * - grocery / transit counts, major roads within 1 km (OpenStreetMap)
 *                                   -> everyday service and noise exposure
 */
export const riskAnalyzer: Analyzer = {
  id: "risk",

  analyze({ attributes }) {
    const buildingYear = numberOrNull(attributes.building_year);
    const renovationYear = numberOrNull(attributes.renovation_year);
    const policyRate = numberOrNull(attributes.policy_rate_pct);
    const populationGrowth = numberOrNull(attributes.area_population_growth_pct);
    const highwayCount = numberOrNull(attributes.highway_major_count_within_1000m);
    const transitCount = numberOrNull(attributes.transit_count_within_1000m);
    const groceryCount = numberOrNull(attributes.grocery_count_within_1000m);

    const supportingData: Record<string, unknown> = {};

    if (buildingYear !== null) {
      supportingData.buildingYear = buildingYear;
      supportingData.buildingAgeYears = new Date().getFullYear() - buildingYear;
      if (renovationYear !== null) supportingData.renovationYear = renovationYear;
    }
    if (policyRate !== null) supportingData.policyRatePct = policyRate;
    if (populationGrowth !== null) supportingData.areaPopulationGrowthPct = populationGrowth;
    if (groceryCount !== null && transitCount !== null) {
      supportingData.amenityCounts = { grocery: groceryCount, transit: transitCount };
    }
    if (highwayCount !== null) supportingData.highwayProximity = highwayCount;

    return { id: "risk", available: Object.keys(supportingData).length > 0, supportingData };
  },
};
