import type { Analyzer } from "./types";
import { numberOrNull } from "../helpers";

/**
 * Market facts — the broader housing-market backdrop, as plain figures:
 * - the Riksbank policy rate and its change over 12 months (Riksbanken)
 * - population growth and median income in the area (SCB)
 * - the municipality's employment rate (Market Intelligence Engine ->
 *   municipal_economics domain, providers/marketIntelligence.ts)
 *
 * Only collected figures are returned; nothing is rated or combined into an
 * index. `available` is true when at least one of the four was collected.
 */
export const marketAnalyzer: Analyzer = {
  id: "market",

  analyze({ attributes }) {
    const rateChange = numberOrNull(attributes.policy_rate_change_12m_pct_points);
    const populationGrowth = numberOrNull(attributes.area_population_growth_pct);
    const medianIncome = numberOrNull(attributes.median_income_sek_thousands);
    const currentRate = numberOrNull(attributes.policy_rate_pct);
    const employmentRate = numberOrNull(attributes.municipality_employment_rate_pct);

    const supportingData: Record<string, unknown> = {};
    if (rateChange !== null) {
      supportingData.policyRateChangePctPoints = rateChange;
      if (currentRate !== null) supportingData.currentPolicyRatePct = currentRate;
    }
    if (populationGrowth !== null) supportingData.areaPopulationGrowthPct = populationGrowth;
    if (medianIncome !== null) supportingData.medianIncomeThousandsSek = medianIncome;
    if (employmentRate !== null) supportingData.municipalityEmploymentRatePct = employmentRate;

    const available = rateChange !== null || populationGrowth !== null || medianIncome !== null || employmentRate !== null;
    return { id: "market", available, supportingData };
  },
};
