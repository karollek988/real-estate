import type { Analyzer } from "./types";
import { numberOrNull, parseAreaSoldPriceTrend, priceTrendFromSeries } from "../helpers";

/**
 * Area facts — how the area around the address has developed.
 *
 * The address being geocoded (municipality / postal code verified) is identity,
 * not development, so it is recorded but does not make the factor `available`.
 * The price trend comes from the Booli nearby-sold-comparables quarterly series
 * (`attributes.area_sold_price_trend`, providers/booli.ts::summarizeSoldListings);
 * population growth comes from SCB (`attributes.area_population_growth_pct`).
 * Only facts that were actually collected are returned — a missing signal is
 * left out, never replaced by a default.
 */
export const areaAnalyzer: Analyzer = {
  id: "area",

  analyze({ property, attributes }) {
    const trend = priceTrendFromSeries(parseAreaSoldPriceTrend(attributes.area_sold_price_trend));
    const populationGrowthPct = numberOrNull(attributes.area_population_growth_pct);

    const supportingData: Record<string, unknown> = {};
    if (property.municipality) supportingData.municipality = property.municipality;
    if (property.postalCode) supportingData.postalCode = property.postalCode;
    if (trend !== null) {
      supportingData.areaPriceTrendPct = trend.pct;
      supportingData.areaPriceTrendPeriod = `${trend.fromPeriod}–${trend.toPeriod}`;
    }
    if (populationGrowthPct !== null) supportingData.areaPopulationGrowthPct = populationGrowthPct;

    return { id: "area", available: trend !== null || populationGrowthPct !== null, supportingData };
  },
};
