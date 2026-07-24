import type { Analyzer } from "./types";
import { clamp, insufficientDataFactor, numberOrNull, sourceLabel } from "../helpers";

const ID = "market";
const LABEL = "Market Trend";
const WEIGHT = 0.15;

/**
 * Market Analyzer — is the broader housing market rising, flat, or falling?
 *
 * Uses four real signals when available:
 * - Interest rate trend (Riksbanken): falling rates → positive, rising → negative
 * - Population growth (SCB): growing population → positive demand signal
 * - Median income level (SCB): higher income → stronger purchasing power
 * - Municipal employment rate (Market Intelligence Engine ->
 *   municipal_economics domain, providers/marketIntelligence.ts): higher
 *   local employment → stronger, more stable housing demand
 *
 * Each signal contributes to a weighted composite score.
 */
export const marketAnalyzer: Analyzer = {
  id: ID,
  label: LABEL,
  weight: WEIGHT,

  analyze({ attributes, dataSources }) {
    const rateChange = numberOrNull(attributes.policy_rate_change_12m_pct_points);
    const populationGrowth = numberOrNull(attributes.area_population_growth_pct);
    const medianIncome = numberOrNull(attributes.median_income_sek_thousands);
    const currentRate = numberOrNull(attributes.policy_rate_pct);
    const employmentRate = numberOrNull(attributes.municipality_employment_rate_pct);

    const supportingData: Record<string, unknown> = {};

    if (rateChange === null && populationGrowth === null && medianIncome === null && employmentRate === null) {
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: 0.05,
        status: "No market data",
        explanation:
          "No housing market indicators are available yet — interest rates, population trends, and income data are needed to assess the market.",
        missingData: [
          sourceLabel(dataSources, "interest_rates"),
          sourceLabel(dataSources, "scb_area_statistics"),
        ],
      });
    }

    const parts: string[] = [];
    let weightedSum = 0;
    let weightTotal = 0;

    // Interest rate trend: the strongest macro signal for housing
    // Falling rates = more buying power = positive market
    // Rising rates = less buying power = negative market
    if (rateChange !== null) {
      supportingData.policyRateChangePctPoints = rateChange;
      if (currentRate !== null) supportingData.currentPolicyRatePct = currentRate;

      // -2pp change → score ~70, +2pp change → score ~30, 0 change → 50
      const rateScore = clamp(50 - rateChange * 10, 0, 100);
      weightedSum += rateScore * 0.5;
      weightTotal += 0.5;

      if (rateChange < -0.25) {
        parts.push(`the policy rate has decreased by ${Math.abs(rateChange).toFixed(2)} percentage points over the past year, which typically supports housing demand`);
      } else if (rateChange > 0.25) {
        parts.push(`the policy rate has increased by ${rateChange.toFixed(2)} percentage points over the past year, which typically suppresses housing demand`);
      } else {
        parts.push(`the policy rate has been relatively stable at ${currentRate?.toFixed(1) ?? "?"}%`);
      }
    }

    // Population growth: long-term demand signal
    if (populationGrowth !== null) {
      supportingData.areaPopulationGrowthPct = populationGrowth;

      // +3% growth → score ~70, -3% → score ~30, 0% → 50
      const popScore = clamp(50 + populationGrowth * 7, 0, 100);
      weightedSum += popScore * 0.3;
      weightTotal += 0.3;

      parts.push(`population has ${populationGrowth >= 0 ? "grown" : "declined"} by ${Math.abs(populationGrowth).toFixed(1)}% over 5 years`);
    }

    // Median income: purchasing power indicator
    if (medianIncome !== null) {
      supportingData.medianIncomeThousandsSek = medianIncome;

      // Higher income = stronger market (relative to national ~340k)
      // 340k → score ~50, 450k → score ~65, 250k → score ~35
      const incomeScore = clamp(50 + (medianIncome - 340) * 0.13, 0, 100);
      weightedSum += incomeScore * 0.2;
      weightTotal += 0.2;

      parts.push(`median income in the area is ${Math.round(medianIncome)} tkr`);
    }

    // Municipal employment rate: labor-market strength underpins housing demand
    if (employmentRate !== null) {
      supportingData.municipalityEmploymentRatePct = employmentRate;

      // Sweden's national employment rate is roughly 75-80%; higher local
      // employment → stronger, more stable demand (75% → score ~50).
      const employmentScore = clamp(50 + (employmentRate - 75) * 4, 0, 100);
      weightedSum += employmentScore * 0.2;
      weightTotal += 0.2;

      parts.push(`the municipality's employment rate is ${employmentRate.toFixed(1)}%`);
    }

    const score = weightTotal > 0 ? Math.round(clamp(weightedSum / weightTotal, 0, 100)) : 50;

    let status: string;
    let confidence: number;
    if (weightTotal >= 0.7) {
      confidence = 0.75;
      status = score >= 65 ? "Positive" : score >= 45 ? "Stable" : "Challenging";
    } else if (weightTotal >= 0.3) {
      confidence = 0.5;
      status = score >= 60 ? "Moderately positive" : score >= 40 ? "Uncertain" : "Moderately negative";
    } else {
      confidence = 0.3;
      status = "Limited data";
    }

    const explanation = parts.length > 0
      ? `Market indicators: ${parts.join("; ")}.`
      : "Limited market data available.";

    return {
      id: ID,
      label: LABEL,
      weight: WEIGHT,
      score,
      confidence,
      status,
      explanation,
      supportingData,
      missingData: rateChange === null
        ? [sourceLabel(dataSources, "interest_rates")]
        : populationGrowth === null
          ? [sourceLabel(dataSources, "scb_area_statistics")]
          : employmentRate === null
            ? [sourceLabel(dataSources, "market_intelligence")]
            : [],
    };
  },
};
