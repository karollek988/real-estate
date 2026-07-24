import type { Analyzer } from "./types";
import { clamp, insufficientDataFactor, numberOrNull, parseAreaSoldPriceTrend, priceTrendFromSeries, sourceLabel } from "../helpers";

const ID = "area";
const LABEL = "Area Development";
const WEIGHT = 0.10;

/**
 * Area Analyzer — is the surrounding area developing favorably?
 *
 * Real today: whether the address was actually geocoded (municipality/
 * postal code verified) — that's identity, not development potential, so
 * it only affects confidence, never the score. Price trend is derived from
 * the Booli nearby-sold-comparables quarterly series
 * (`attributes.area_sold_price_trend`, providers/booli.ts::summarizeSoldListings)
 * — this analyzer's own `area_price_trend_pct` forward contract, resolved
 * without a separate Mäklarstatistik source. Population growth comes from
 * SCB (`attributes.area_population_growth_pct`).
 */
export const areaAnalyzer: Analyzer = {
  id: ID,
  label: LABEL,
  weight: WEIGHT,

  analyze({ property, attributes, dataSources }) {
    const areaSoldPriceTrend = parseAreaSoldPriceTrend(attributes.area_sold_price_trend);
    const trend = priceTrendFromSeries(areaSoldPriceTrend);
    const priceTrendPct = trend?.pct ?? null;
    const populationGrowthPct = numberOrNull(attributes.area_population_growth_pct);

    const supportingData: Record<string, unknown> = {};
    if (property.municipality) supportingData.municipality = property.municipality;
    if (property.postalCode) supportingData.postalCode = property.postalCode;

    if (priceTrendPct === null && populationGrowthPct === null) {
      const locationVerified = property.municipality !== null;
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: locationVerified ? 0.15 : 0.05,
        status: "No area data",
        explanation: locationVerified
          ? `The property's location in ${property.municipality} is verified, but area development statistics (price trend, demographics) aren't connected yet.`
          : "The property's location isn't verified yet, and area development statistics aren't connected — development potential can't be evaluated.",
        supportingData,
        missingData: [sourceLabel(dataSources, "booli_listing"), sourceLabel(dataSources, "scb_area_statistics")],
      });
    }

    // Score only from whichever signal(s) are actually present — never
    // substitute a default for a signal that wasn't collected. Price trend
    // is weighted higher than population growth when both are available.
    const parts: string[] = [];
    let weightedSum = 0;
    let weightTotal = 0;

    if (priceTrendPct !== null && trend !== null) {
      weightedSum += (50 + priceTrendPct * 3) * 0.7;
      weightTotal += 0.7;
      parts.push(
        `a price trend of ${priceTrendPct >= 0 ? "+" : ""}${priceTrendPct}% from ${trend.fromPeriod} to ${trend.toPeriod} (based on nearby sold comparables)`
      );
      supportingData.areaPriceTrendPct = priceTrendPct;
      supportingData.areaPriceTrendPeriod = `${trend.fromPeriod}–${trend.toPeriod}`;
    }
    if (populationGrowthPct !== null) {
      weightedSum += (50 + populationGrowthPct * 2) * 0.3;
      weightTotal += 0.3;
      parts.push(`population growth of ${populationGrowthPct >= 0 ? "+" : ""}${populationGrowthPct}%`);
      supportingData.areaPopulationGrowthPct = populationGrowthPct;
    }

    const score = Math.round(clamp(weightedSum / weightTotal, 0, 100));
    return {
      id: ID,
      label: LABEL,
      weight: WEIGHT,
      score,
      confidence: priceTrendPct !== null ? 0.7 : 0.5,
      status: score >= 65 ? "Positive" : score >= 45 ? "Stable" : "Declining",
      explanation: `The area shows ${parts.join(" and ")}.`,
      supportingData,
      missingData: priceTrendPct === null
        ? [sourceLabel(dataSources, "booli_listing")]
        : populationGrowthPct === null
          ? [sourceLabel(dataSources, "scb_area_statistics")]
          : [],
    };
  },
};
