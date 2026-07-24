import type { Analyzer } from "./types";
import { clamp, insufficientDataFactor, numberOrNull, sourceLabel } from "../helpers";

const ID = "risk";
const LABEL = "Risk Level";
const WEIGHT = 0.15;

/**
 * Risk Analyzer — composite risk assessment from multiple signals.
 *
 * Real signals used:
 * - Building year: older buildings carry higher maintenance/renovation risk
 * - Interest rate level: higher rates = higher refinancing risk for BRFs
 * - Population trend: declining population = weakening long-term demand
 * - Amenity density: very few nearby amenities = isolation risk
 * - Highway proximity: nearby major roads = noise/air quality risk
 *
 * Lower score = more risk (inverted from other analyzers).
 */
export const riskAnalyzer: Analyzer = {
  id: ID,
  label: LABEL,
  weight: WEIGHT,

  analyze({ attributes, dataSources }) {
    const buildingYear = numberOrNull(attributes.building_year);
    const renovationYear = numberOrNull(attributes.renovation_year);
    const currentRate = numberOrNull(attributes.policy_rate_pct);
    const populationGrowth = numberOrNull(attributes.area_population_growth_pct);
    const highwayCount = numberOrNull(attributes.highway_major_count_within_1000m);
    const transitCount = numberOrNull(attributes.transit_count_within_1000m);
    const groceryCount = numberOrNull(attributes.grocery_count_within_1000m);
    const hospitalCount = numberOrNull(attributes.hospital_count_within_1000m);
    const medianIncome = numberOrNull(attributes.median_income_sek_thousands);

    const supportingData: Record<string, unknown> = {};

    if (buildingYear === null && currentRate === null && populationGrowth === null) {
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: 0.05,
        status: "No risk data",
        explanation:
          "No building details, financial data, or area statistics are available yet to assess risk.",
        missingData: [
          sourceLabel(dataSources, "hemnet_page_scrape"),
          sourceLabel(dataSources, "interest_rates"),
          sourceLabel(dataSources, "scb_area_statistics"),
          sourceLabel(dataSources, "osm_amenities"),
        ],
      });
    }

    const riskFactors: Array<{ factor: string; score: number; weight: number; detail: string }> = [];

    // Building age risk
    if (buildingYear !== null) {
      const age = new Date().getFullYear() - buildingYear;
      const lastMajorWork = renovationYear !== null
        ? new Date().getFullYear() - renovationYear
        : age;

      supportingData.buildingYear = buildingYear;
      if (renovationYear !== null) supportingData.renovationYear = renovationYear;
      supportingData.buildingAgeYears = age;

      // Newer building = lower risk. Post-2000 = low risk, pre-1960 = high risk
      // Recently renovated reduces risk significantly
      let ageScore: number;
      if (lastMajorWork <= 10) {
        ageScore = 80; // recently renovated = low risk
      } else if (lastMajorWork <= 20) {
        ageScore = 65;
      } else if (age <= 30) {
        ageScore = 70; // relatively new, even without renovation
      } else if (age <= 50) {
        ageScore = 50;
      } else if (age <= 80) {
        ageScore = 35;
      } else {
        ageScore = 20; // very old = high risk
      }

      const detail = renovationYear !== null
        ? `Built ${buildingYear} (${age} years old), last major work ${renovationYear} (${lastMajorWork} years ago).`
        : `Built ${buildingYear} (${age} years old), no known major renovations.`;

      riskFactors.push({ factor: "building_age", score: ageScore, weight: 0.3, detail });
    }

    // Interest rate risk (affects BRF refinancing costs)
    if (currentRate !== null) {
      supportingData.policyRatePct = currentRate;

      // Low rates (< 1%) = low risk, high rates (> 4%) = high risk
      const rateScore = clamp(80 - currentRate * 15, 10, 95);
      riskFactors.push({
        factor: "interest_rate",
        score: rateScore,
        weight: 0.25,
        detail: `Current policy rate is ${currentRate.toFixed(1)}%. ${currentRate > 3 ? "High rates increase refinancing costs for the housing association." : currentRate < 1.5 ? "Low rates keep refinancing costs manageable." : "Moderate rate environment."}`,
      });
    }

    // Population trend risk
    if (populationGrowth !== null) {
      supportingData.areaPopulationGrowthPct = populationGrowth;

      // Growing = low risk, declining = high risk
      const popScore = clamp(50 + populationGrowth * 8, 10, 90);
      riskFactors.push({
        factor: "population_trend",
        score: popScore,
        weight: 0.2,
        detail: `Population has ${populationGrowth >= 0 ? "grown" : "declined"} by ${Math.abs(populationGrowth).toFixed(1)}% over 5 years, indicating ${populationGrowth > 1 ? "strong" : populationGrowth > 0 ? "stable" : "weakening"} long-term demand.`,
      });
    }

    // Amenity isolation risk
    if (groceryCount !== null && transitCount !== null) {
      const amenityScore = Math.min(
        groceryCount > 3 ? 75 : groceryCount > 1 ? 60 : 40,
        transitCount > 5 ? 75 : transitCount > 2 ? 60 : 40
      );
      supportingData.amenityCounts = { grocery: groceryCount, transit: transitCount };

      const detailParts: string[] = [];
      if (groceryCount <= 1) detailParts.push("very few nearby grocery stores");
      if (transitCount <= 2) detailParts.push("limited public transport stops");
      if (hospitalCount !== null && hospitalCount === 0) detailParts.push("no nearby hospital");

      riskFactors.push({
        factor: "amenity_access",
        score: amenityScore,
        weight: 0.1,
        detail: detailParts.length > 0
          ? `Limited amenity access: ${detailParts.join(", ")}.`
          : "Good amenity access in the area.",
      });
    }

    // Highway/noise risk
    if (highwayCount !== null) {
      supportingData.highwayProximity = highwayCount;

      // More highways nearby = more noise risk
      const noiseScore = highwayCount === 0 ? 80 : highwayCount <= 2 ? 55 : 30;
      riskFactors.push({
        factor: "noise_exposure",
        score: noiseScore,
        weight: 0.1,
        detail: highwayCount === 0
          ? "No major highways within 1 km — low noise exposure."
          : `${highwayCount} major road${highwayCount > 1 ? "s" : ""} within 1 km — potential noise and air quality concerns.`,
      });
    }

    // Income stability risk
    if (medianIncome !== null) {
      supportingData.medianIncomeThousandsSek = medianIncome;

      // Higher income = more financial stability in the area
      const incomeScore = medianIncome > 400 ? 75 : medianIncome > 320 ? 60 : medianIncome > 250 ? 45 : 30;
      riskFactors.push({
        factor: "income_stability",
        score: incomeScore,
        weight: 0.05,
        detail: `Median income in the area is ${Math.round(medianIncome)} tkr, suggesting ${medianIncome > 400 ? "strong" : medianIncome > 320 ? "moderate" : "lower"} financial stability among residents.`,
      });
    }

    if (riskFactors.length === 0) {
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: 0.1,
        status: "Insufficient data",
        explanation: "Not enough data points to assess risk.",
        missingData: [],
      });
    }

    // Weighted average of risk factors (higher score = lower risk)
    let weightedSum = 0;
    let weightTotal = 0;
    for (const rf of riskFactors) {
      weightedSum += rf.score * rf.weight;
      weightTotal += rf.weight;
    }
    const score = Math.round(clamp(weightedSum / weightTotal, 0, 100));

    const highRisks = riskFactors.filter((rf) => rf.score < 40);
    const lowRisks = riskFactors.filter((rf) => rf.score >= 70);

    let status: string;
    if (score >= 70) status = "Low risk";
    else if (score >= 50) status = "Moderate risk";
    else if (score >= 35) status = "Elevated risk";
    else status = "High risk";

    const explanation = riskFactors.map((rf) => rf.detail).join(" ");

    return {
      id: ID,
      label: LABEL,
      weight: WEIGHT,
      score,
      confidence: riskFactors.length >= 3 ? 0.7 : riskFactors.length >= 2 ? 0.55 : 0.4,
      status,
      explanation,
      supportingData: {
        ...supportingData,
        riskFactors: riskFactors.map((rf) => ({
          factor: rf.factor,
          score: rf.score,
          weight: rf.weight,
        })),
        highRisks: highRisks.length,
        lowRisks: lowRisks.length,
      },
      missingData: buildingYear === null
        ? [sourceLabel(dataSources, "hemnet_page_scrape")]
        : currentRate === null
          ? [sourceLabel(dataSources, "interest_rates")]
          : [],
    };
  },
};
