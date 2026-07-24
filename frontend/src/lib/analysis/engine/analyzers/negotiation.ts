import type { Analyzer } from "./types";
import { clamp, insufficientDataFactor, numberOrNull, sourceLabel, stringOrNull } from "../helpers";

const ID = "negotiation";
const LABEL = "Negotiation Potential";
const WEIGHT = 0.10;

/**
 * Negotiation Analyzer — room to negotiate below asking price.
 *
 * Real signals:
 * - Days on market: longer = more negotiation room
 * - Price vs area income: high price relative to local income = less buyer pool
 * - Interest rate environment: high rates = fewer competing buyers = leverage
 * - Population trend: declining area = weaker demand = more room
 */
export const negotiationAnalyzer: Analyzer = {
  id: ID,
  label: LABEL,
  weight: WEIGHT,

  analyze({ attributes, dataSources }) {
    const listingDate = stringOrNull(attributes.listing_date);
    const askingPrice = numberOrNull(attributes.asking_price_sek);
    const medianIncome = numberOrNull(attributes.median_income_sek_thousands);
    const currentRate = numberOrNull(attributes.policy_rate_pct);
    const populationGrowth = numberOrNull(attributes.area_population_growth_pct);
    const livingArea = numberOrNull(attributes.living_area_m2);

    const supportingData: Record<string, unknown> = {};

    if (!listingDate && askingPrice === null && currentRate === null) {
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: 0.05,
        status: "No negotiation data",
        explanation:
          "No listing history or market context is available to assess negotiation potential.",
        missingData: [
          sourceLabel(dataSources, "hemnet_page_scrape"),
          sourceLabel(dataSources, "interest_rates"),
          sourceLabel(dataSources, "scb_area_statistics"),
        ],
      });
    }

    const signals: Array<{ factor: string; score: number; weight: number; detail: string }> = [];

    // Days on market: strongest negotiation signal
    if (listingDate) {
      const parsed = new Date(listingDate);
      if (Number.isFinite(parsed.getTime())) {
        const daysOnMarket = Math.floor(
          (Date.now() - parsed.getTime()) / 86_400_000
        );

        if (daysOnMarket > 0) {
          supportingData.daysOnMarket = daysOnMarket;
          supportingData.listingDate = listingDate;

          // <7 days = no leverage, 7-30 = mild, 30-60 = moderate, 60+ = strong
          let domScore: number;
          if (daysOnMarket < 7) domScore = 30;
          else if (daysOnMarket < 21) domScore = 45;
          else if (daysOnMarket < 45) domScore = 60;
          else if (daysOnMarket < 90) domScore = 75;
          else domScore = 85;

          const detail = daysOnMarket < 7
            ? `Listed ${daysOnMarket} day${daysOnMarket > 1 ? "s" : ""} ago — too fresh for significant negotiation.`
            : daysOnMarket < 30
              ? `On the market for ${daysOnMarket} days — mild negotiation room as the listing is no longer new.`
              : daysOnMarket < 60
                ? `On the market for ${daysOnMarket} days — moderate negotiation room as the seller may be motivated.`
                : `On the market for ${daysOnMarket} days — strong negotiation potential as prolonged listings often indicate flexibility.`;

          signals.push({ factor: "days_on_market", score: domScore, weight: 0.4, detail });
        }
      }
    }

    // Price-to-income ratio: how affordable is this for local buyers?
    if (askingPrice !== null && medianIncome !== null && livingArea !== null) {
      // Price relative to annual income (income in thousands, price in SEK)
      const incomeRatio = askingPrice / (medianIncome * 1000);
      supportingData.priceToIncomeRatio = Math.round(incomeRatio * 10) / 10;

      // Ratio < 3 = affordable = more competition = less leverage
      // Ratio > 7 = very expensive = fewer buyers = more leverage
      const ratioScore = clamp(20 + incomeRatio * 8, 15, 90);
      signals.push({
        factor: "affordability",
        score: ratioScore,
        weight: 0.25,
        detail: `The price is approximately ${incomeRatio.toFixed(1)}x the median annual income in the area. ${incomeRatio > 6 ? "This is expensive relative to local incomes, meaning fewer competing buyers." : incomeRatio < 4 ? "This is within reach for many local buyers, creating competition." : "Moderate affordability — some buyer pool limitation."}`,
      });
    }

    // Interest rate environment: high rates reduce competition
    if (currentRate !== null) {
      supportingData.currentPolicyRatePct = currentRate;

      // High rates = fewer buyers = more negotiation room
      // Low rates = more competition = less leverage
      const rateScore = clamp(25 + currentRate * 12, 15, 85);
      signals.push({
        factor: "rate_environment",
        score: rateScore,
        weight: 0.2,
        detail: currentRate > 3.5
          ? `High interest rates (${currentRate.toFixed(1)}%) reduce the number of competing buyers, strengthening your negotiating position.`
          : currentRate < 1.5
            ? `Low interest rates (${currentRate.toFixed(1)}%) mean more buyers can afford to bid, weakening negotiation leverage.`
            : `Moderate interest rates (${currentRate.toFixed(1)}%) — a balanced market for negotiation.`,
      });
    }

    // Population trend: declining areas = more leverage
    if (populationGrowth !== null) {
      supportingData.areaPopulationGrowthPct = populationGrowth;

      const popScore = populationGrowth > 2 ? 30 : populationGrowth > 0 ? 45 : populationGrowth > -1 ? 60 : 75;
      signals.push({
        factor: "demand_trend",
        score: popScore,
        weight: 0.15,
        detail: populationGrowth > 1
          ? `Growing population (${populationGrowth >= 0 ? "+" : ""}${populationGrowth.toFixed(1)}%) means strong demand — less room to negotiate.`
          : populationGrowth > 0
            ? `Stable population (${populationGrowth.toFixed(1)}%) — moderate demand.`
            : `Declining population (${populationGrowth.toFixed(1)}%) weakens demand, creating more room to negotiate.`,
      });
    }

    if (signals.length === 0) {
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: 0.15,
        status: "Limited data",
        explanation: "Some data is available but not enough for a confident negotiation assessment.",
        missingData: [],
      });
    }

    // Weighted average
    let weightedSum = 0;
    let weightTotal = 0;
    for (const sig of signals) {
      weightedSum += sig.score * sig.weight;
      weightTotal += sig.weight;
    }
    const score = Math.round(clamp(weightedSum / weightTotal, 0, 100));

    const confidence = signals.length >= 3 ? 0.7 : signals.length >= 2 ? 0.55 : 0.4;
    const status = score >= 70 ? "Strong potential" : score >= 50 ? "Moderate potential" : score >= 35 ? "Limited potential" : "Low potential";

    const explanation = signals.map((s) => s.detail).join(" ");

    return {
      id: ID,
      label: LABEL,
      weight: WEIGHT,
      score,
      confidence,
      status,
      explanation,
      supportingData: {
        ...supportingData,
        signals: signals.map((s) => ({ factor: s.factor, score: s.score })),
      },
      missingData: !listingDate ? [sourceLabel(dataSources, "hemnet_page_scrape")] : [],
    };
  },
};
