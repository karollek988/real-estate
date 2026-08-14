import type { Analyzer } from "./types";
import { clamp, formatSek, insufficientDataFactor, numberOrNull, sourceLabel, stringOrNull } from "../helpers";

const ID = "price";
const LABEL = "Price Level";
const WEIGHT = 0.25;

/** Elapsed time in years from an ISO date string to now, or null if the date doesn't parse. */
function yearsSince(dateIso: string): number | null {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

/** Pulls `pricePerM2Sek` out of a comparable-sales array without assuming its shape. */
function extractComparablePricesPerM2(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const v of value) {
    const p = v && typeof v === "object" ? (v as Record<string, unknown>).pricePerM2Sek : null;
    if (typeof p === "number" && Number.isFinite(p)) out.push(p);
  }
  return out;
}

/**
 * Price Analyzer — is the asking price reasonable?
 *
 * Without a comparables benchmark, we can still assess:
 * - Price per m² as an absolute measure
 * - Monthly cost burden (estimated mortgage + fee vs local income)
 * - Price relative to income (affordability)
 *
 * When area_median_price_per_m2_sek becomes available, this analyzer
 * automatically upgrades to relative comparison.
 */
export const priceAnalyzer: Analyzer = {
  id: ID,
  label: LABEL,
  weight: WEIGHT,

  analyze({ attributes, dataSources }) {
    const askingPrice = numberOrNull(attributes.asking_price_sek);
    const livingArea = numberOrNull(attributes.living_area_m2);
    const monthlyFee = numberOrNull(attributes.monthly_fee_sek);
    const areaMedianPerM2 = numberOrNull(attributes.area_median_price_per_m2_sek);
    const medianIncome = numberOrNull(attributes.median_income_sek_thousands);
    const currentRate = numberOrNull(attributes.policy_rate_pct);

    if (askingPrice === null) {
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: 0.05,
        status: "No listing price",
        explanation:
          "No asking price is available for this property yet, so price level can't be evaluated.",
        missingData: [sourceLabel(dataSources, "hemnet_page_scrape")],
      });
    }

    const supportingData: Record<string, unknown> = { askingPriceSek: askingPrice };

    // Comparable sales: prefer this listing's own Hemnet-page-sourced
    // comparables (providers/hemnetPage.ts, `similarSaleCards` — specific to
    // this exact listing) over Booli's area-wide /sold search
    // (providers/booli.ts::summarizeSoldListings) when both exist; passed
    // through as-is for the report's price chapter to render. This
    // analyzer's own score only uses the derived areaMedianPerM2 above.
    if (Array.isArray(attributes.hemnet_comparable_sales) && attributes.hemnet_comparable_sales.length > 0) {
      supportingData.comparableSales = attributes.hemnet_comparable_sales;
      supportingData.comparableSalesCount = attributes.hemnet_comparable_sales.length;
    } else if (Array.isArray(attributes.comparable_sales) && attributes.comparable_sales.length > 0) {
      supportingData.comparableSales = attributes.comparable_sales;
      supportingData.comparableSalesCount = numberOrNull(attributes.comparable_sales_count) ?? attributes.comparable_sales.length;
    }
    if (Array.isArray(attributes.area_sold_price_trend) && attributes.area_sold_price_trend.length > 0) {
      supportingData.areaSoldPriceTrend = attributes.area_sold_price_trend;
    }

    let pricePerM2: number | null = null;
    if (livingArea !== null && livingArea > 0) {
      pricePerM2 = Math.round(askingPrice / livingArea);
      supportingData.pricePerM2Sek = pricePerM2;
    }

    // This property's own price appreciation since it last sold (distinct
    // from the area-wide trend below): total % change, and — when the
    // previous sale date parses — an annualized rate (CAGR) so a sale from
    // 10 years ago isn't compared on equal footing with one from last year.
    // Presentation-only: these numbers feed the report's price chapter via
    // supportingData but never change this analyzer's own score, to avoid
    // silently re-calibrating price-level scoring as a side effect of
    // surfacing this history to the reader.
    const previousSalePriceSek = numberOrNull(attributes.previous_sale_price_sek);
    const previousSaleDate = stringOrNull(attributes.previous_sale_date);
    if (previousSalePriceSek !== null && previousSalePriceSek > 0) {
      supportingData.priceChangeSincePreviousSalePct =
        Math.round(((askingPrice - previousSalePriceSek) / previousSalePriceSek) * 1000) / 10;

      const years = previousSaleDate ? yearsSince(previousSaleDate) : null;
      if (years !== null && years >= 0.25) {
        const cagrPct = (Math.pow(askingPrice / previousSalePriceSek, 1 / years) - 1) * 100;
        supportingData.priceChangeSincePreviousSaleCagrPct = Math.round(cagrPct * 10) / 10;
        supportingData.yearsSincePreviousSale = Math.round(years * 10) / 10;
      }
    }

    // Where this asking price's price/m² ranks among the comparable sold
    // homes already collected above — e.g. "below all 6 comparables" reads
    // very differently from "in the middle of the pack", and that context
    // was previously discarded once the comparables were reduced to a
    // median for the relative-comparison score below.
    const comparablePricesPerM2 = extractComparablePricesPerM2(supportingData.comparableSales);
    if (pricePerM2 !== null && comparablePricesPerM2.length > 0) {
      const lowerCount = comparablePricesPerM2.filter((v) => v < (pricePerM2 as number)).length;
      supportingData.comparableSalesPricePerM2Percentile = Math.round((lowerCount / comparablePricesPerM2.length) * 100);
      supportingData.comparableSalesPricePerM2Min = Math.min(...comparablePricesPerM2);
      supportingData.comparableSalesPricePerM2Max = Math.max(...comparablePricesPerM2);
      supportingData.comparableSalesPricePerM2Count = comparablePricesPerM2.length;
    }

    // If we have area comparables, use the relative comparison
    if (areaMedianPerM2 !== null && pricePerM2 !== null) {
      supportingData.areaMedianPricePerM2Sek = areaMedianPerM2;
      const deltaPct = ((pricePerM2 - areaMedianPerM2) / areaMedianPerM2) * 100;
      supportingData.deltaVsAreaMedianPct = Math.round(deltaPct * 10) / 10;
      const score = Math.round(clamp(50 - deltaPct * 5, 0, 100));
      const status = score >= 80 ? "Excellent value" : score >= 60 ? "Good value" : score >= 40 ? "Fair price" : "Above market";
      const direction = deltaPct < 0 ? "below" : "above";

      return {
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        score,
        confidence: 0.85,
        status,
        explanation: `Asking price is approximately ${Math.abs(Math.round(deltaPct))}% ${direction} the area's median price per m².`,
        supportingData,
        missingData: [],
      };
    }

    // No comparables — assess affordability instead
    const signals: Array<{ signal: string; score: number; weight: number; text: string }> = [];

    // Monthly cost burden: mortgage + fee vs income
    if (medianIncome !== null && currentRate !== null) {
      // Estimated monthly mortgage (80% LTV, 30-year amortization)
      const loanAmount = askingPrice * 0.8;
      const monthlyInterest = loanAmount * (currentRate / 100) / 12;
      const monthlyAmortization = loanAmount / (30 * 12);
      const totalMonthly = monthlyInterest + monthlyAmortization + (monthlyFee ?? 0);
      const monthlyIncome = (medianIncome * 1000) / 12;
      const burdenPct = (totalMonthly / monthlyIncome) * 100;

      supportingData.estimatedMonthlyCost = Math.round(totalMonthly);
      supportingData.costBurdenPct = Math.round(burdenPct * 10) / 10;
      supportingData.monthlyMortgageEstimate = Math.round(monthlyInterest + monthlyAmortization);
      if (monthlyFee !== null) supportingData.monthlyFeeSek = monthlyFee;

      // <30% = affordable, 30-40% = moderate, 40-50% = stretched, >50% = severe
      const burdenScore = clamp(90 - burdenPct * 1.5, 10, 90);
      signals.push({
        signal: "cost_burden",
        score: burdenScore,
        weight: 0.5,
        text: `Estimated monthly housing cost is ${Math.round(totalMonthly).toLocaleString("sv-SE")} kr (${Math.round(burdenPct)}% of median area income). ${burdenPct < 30 ? "This is affordable for most buyers." : burdenPct < 40 ? "Moderate cost burden — manageable for most buyers." : burdenPct < 50 ? "Significant cost burden — may limit the buyer pool." : "Severe cost burden — will significantly limit potential buyers."}`,
      });
    }

    // Absolute price level context
    if (pricePerM2 !== null) {
      supportingData.pricePerM2Sek = pricePerM2;

      // Stockholm average ~60k/m², national ~35k/m²
      // This is a rough benchmark
      const m2Score = pricePerM2 < 30000 ? 75 : pricePerM2 < 45000 ? 65 : pricePerM2 < 60000 ? 50 : pricePerM2 < 80000 ? 35 : 20;
      signals.push({
        signal: "absolute_price",
        score: m2Score,
        weight: 0.3,
        text: `Price per m² is ${formatSek(pricePerM2)}. ${pricePerM2 < 35000 ? "Below the national average — relatively affordable." : pricePerM2 < 55000 ? "In the typical range for Swedish urban areas." : pricePerM2 < 75000 ? "Above average — common in major city areas." : "Premium pricing, typical of central Stockholm/Gothenburg."}`,
      });
    }

    // Total price context
    if (askingPrice !== null) {
      const priceLabel = askingPrice < 2_000_000 ? "entry-level"
        : askingPrice < 4_000_000 ? "mid-range"
        : askingPrice < 7_000_000 ? "upper mid-range"
        : "premium";

      supportingData.priceRange = priceLabel;

      const priceScore = askingPrice < 2_000_000 ? 70 : askingPrice < 4_000_000 ? 60 : askingPrice < 7_000_000 ? 50 : 40;
      signals.push({
        signal: "price_range",
        score: priceScore,
        weight: 0.2,
        text: `At ${formatSek(askingPrice)}, this is a ${priceLabel} property.`,
      });
    }

    if (signals.length === 0) {
      return insufficientDataFactor({
        id: ID,
        label: LABEL,
        weight: WEIGHT,
        confidence: 0.2,
        status: "Limited data",
        explanation: `Asking price is ${formatSek(askingPrice)}, but not enough supporting data (area, income, interest rates) to assess whether it's fair.`,
        supportingData,
        missingData: [
          sourceLabel(dataSources, "hemnet_page_scrape"),
          sourceLabel(dataSources, "scb_area_statistics"),
          sourceLabel(dataSources, "interest_rates"),
        ],
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
    const status = score >= 70 ? "Favorable" : score >= 50 ? "Reasonable" : score >= 35 ? "Premium" : "Overpriced";

    const explanation = signals.map((s) => s.text).join(" ");

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
        signals: signals.map((s) => ({ signal: s.signal, score: s.score })),
      },
      missingData: medianIncome === null
        ? [sourceLabel(dataSources, "scb_area_statistics")]
        : currentRate === null
          ? [sourceLabel(dataSources, "interest_rates")]
          : [],
    };
  },
};
