/**
 * Revenue, costs and the company numbers that follow from a simulation. No React, no database access, so the
 * same code runs in the page and in markov.verify.mjs.
 *
 * What the model counts, and what it leaves out:
 *   revenue   every move into Premium is one purchase. A purchase is a package (Områdesanalys, Trygghetspaketet
 *             or Tre bostäder) chosen with the probabilities of the "mix"; its price includes VAT, so the company's
 *             revenue is the price divided by 1 + VAT.
 *   costs     the payment fee on every purchase (a percentage of the price paid, plus a fixed amount), the ad
 *             spend of the acquisition model, and the fixed monthly costs.
 *   left out  what an analysis costs to produce, the running cost of the channels that are not ads, discount
 *             codes, refunds, and taxes. The result is therefore before all of those.
 *
 * Revenue is booked in the month of the purchase. Someone who stays in Premium does not pay again; to buy again
 * they must leave Premium and come back, which the chain allows (premium -> inactive -> reactivated -> premium).
 */
import { OMRADESANALYS_PRICE_SEK, TRE_BOSTADER_PRICE_SEK, TRYGGHETSPAKET_PRICE_SEK } from "@/lib/pricing";
import { getOneTimeProduct } from "@/lib/stripe/prices";
import { CHANNEL_IDS, type ChannelId } from "./acquisition";
import type { Attribution, Cohort, Simulation } from "./engine";

export const PACKAGE_IDS = ["omradesanalys", "trygghetspaket", "tre_bostader"] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];

export const PACKAGE_LABELS: Record<PackageId, string> = {
  omradesanalys: getOneTimeProduct("omradesanalys").label,
  trygghetspaket: getOneTimeProduct("trygghetspaket").label,
  tre_bostader: getOneTimeProduct("tre_bostader").label,
};

export interface Finance {
  /** what each package costs the buyer, in kr including VAT */
  prices: Record<PackageId, number>;
  /** the share of purchases that is each package, as fractions that add up to 1 */
  mix: Record<PackageId, number>;
  /** VAT as a fraction of the price without it: 0.25 */
  vat: number;
  /** the payment provider's fee: a fraction of the price paid, plus a fixed amount in kr per purchase */
  feePercent: number;
  feeFixed: number;
  /** costs that are paid every month whatever is sold, in kr */
  fixedMonthly: number;
}

/** Example numbers. The prices are the ones on the site; the mix, the fee and the fixed costs are assumptions to replace. */
export const DEFAULT_FINANCE: Finance = {
  prices: { omradesanalys: OMRADESANALYS_PRICE_SEK, trygghetspaket: TRYGGHETSPAKET_PRICE_SEK, tre_bostader: TRE_BOSTADER_PRICE_SEK },
  mix: { omradesanalys: 0.6, trygghetspaket: 0.35, tre_bostader: 0.05 },
  vat: 0.25,
  feePercent: 0.015,
  feeFixed: 1.8,
  fixedMonthly: 5000,
};

// ── one purchase ─────────────────────────────────────────────────────────────

export interface PurchaseEconomics {
  /** the average price paid, including VAT */
  paid: number;
  /** the company's revenue from it: the price without VAT */
  revenue: number;
  /** the payment fee */
  fee: number;
  /** what is left of a purchase after the fee */
  net: number;
}

/** What an average purchase brings in and costs, from the package mix. */
export function purchaseEconomics(finance: Finance): PurchaseEconomics {
  const weight = PACKAGE_IDS.reduce((sum, id) => sum + finance.mix[id], 0) || 1;
  let paid = 0;
  let fee = 0;
  for (const id of PACKAGE_IDS) {
    const share = finance.mix[id] / weight;
    paid += share * finance.prices[id];
    fee += share * (finance.feePercent * finance.prices[id] + finance.feeFixed);
  }
  const revenue = paid / (1 + finance.vat);
  return { paid, revenue, fee, net: revenue - fee };
}

// ── month by month ───────────────────────────────────────────────────────────

export interface Economy {
  /** all of these by month: index t is month t, index 0 is the start (nothing yet) */
  revenue: number[];
  fees: number[];
  adSpend: number[];
  fixed: number[];
  costs: number[];
  profit: number[];
  /** the profit added up from month 1 */
  cumulative: number[];
  totals: { purchases: number; revenue: number; fees: number; adSpend: number; fixed: number; costs: number; profit: number };
  /** the first month with a profit, or null */
  firstProfitMonth: number | null;
  /**
   * When the accumulated result is at zero or above: "start" if it never was below, the month it gets back, or
   * null if that does not happen within the months run (or nothing is sold at all).
   */
  breakEven: "start" | number | null;
  perPurchase: PurchaseEconomics;
}

export function economy(sim: Simulation, finance: Finance): Economy {
  const per = purchaseEconomics(finance);
  const n = sim.months.length;
  const zero = () => new Array<number>(n).fill(0);
  const revenue = zero();
  const fees = zero();
  const adSpend = zero();
  const fixed = zero();
  const costs = zero();
  const profit = zero();
  const cumulative = zero();
  for (let t = 1; t < n; t++) {
    revenue[t] = sim.premiumEntries[t] * per.revenue;
    fees[t] = sim.premiumEntries[t] * per.fee;
    adSpend[t] = sim.spend[t];
    fixed[t] = finance.fixedMonthly;
    costs[t] = fees[t] + adSpend[t] + fixed[t];
    profit[t] = revenue[t] - costs[t];
    cumulative[t] = cumulative[t - 1] + profit[t];
  }
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const totals = { purchases: sum(sim.premiumEntries), revenue: sum(revenue), fees: sum(fees), adSpend: sum(adSpend), fixed: sum(fixed), costs: sum(costs), profit: sum(profit) };

  const first = profit.findIndex((value, t) => t > 0 && value > 0);
  let breakEven: Economy["breakEven"] = null;
  if (totals.revenue > 0) {
    const everBelow = cumulative.some((value, t) => t > 0 && value < 0);
    if (!everBelow) breakEven = "start";
    else {
      const below = cumulative.findIndex((value, t) => t > 0 && value < 0);
      const back = cumulative.findIndex((value, t) => t > below && value >= 0);
      breakEven = back > 0 ? back : null;
    }
  }
  return { revenue, fees, adSpend, fixed, costs, profit, cumulative, totals, firstProfitMonth: first > 0 ? first : null, breakEven, perPurchase: per };
}

// ── by channel ───────────────────────────────────────────────────────────────

export interface ChannelEconomy {
  id: ChannelId;
  visitors: number;
  purchases: number;
  revenue: number;
  fees: number;
  adSpend: number;
  /** revenue - fees - ad spend: what the channel leaves before the fixed costs, which belong to no channel in particular */
  contribution: number;
  /** what 1 000 new visitors from this channel bring in over the months run, after payment fees and VAT */
  valuePer1000: number;
  /** what 1 000 new visitors from this channel cost in ads; null for the channels with no cost in the model */
  costPer1000: number | null;
  /** ad spend per purchase; null when there is no ad spend or no purchase */
  adCostPerPurchase: number | null;
}

/** The result by channel. `cohorts` is what becomes of 1 000 new visitors of each channel alone (engine.cohortForChannel). */
export function channelEconomics(attribution: Attribution, cohorts: Record<ChannelId, Cohort>, finance: Finance): ChannelEconomy[] {
  const per = purchaseEconomics(finance);
  return CHANNEL_IDS.map((id) => {
    const row = attribution.channels.find((channel) => channel.id === id)!;
    const revenue = row.premiumEntries * per.revenue;
    const fees = row.premiumEntries * per.fee;
    return {
      id,
      visitors: row.visitors,
      purchases: row.premiumEntries,
      revenue,
      fees,
      adSpend: row.spend,
      contribution: revenue - fees - row.spend,
      valuePer1000: cohorts[id].purchasesPerVisitor * 1000 * per.net,
      costPer1000: row.spend > 0 && row.visitors > 0 ? (row.spend / row.visitors) * 1000 : null,
      adCostPerPurchase: row.spend > 0 && row.premiumEntries >= 0.5 ? row.spend / row.premiumEntries : null,
    };
  });
}

// ── the company's numbers ────────────────────────────────────────────────────

export interface CompanyKpis {
  /** all costs apart from the payment fees (ads and fixed), per purchase; null with no purchases */
  costPerPurchase: number | null;
  /** the ads alone, per purchase */
  adCostPerPurchase: number | null;
  /** what 1 000 new visitors bring in over the months run: revenue after payment fees, without VAT */
  valuePer1000: number;
  /** purchases per paying customer (people who buy again count again), and what a paying customer is worth */
  purchasesPerCustomer: number | null;
  valuePerCustomer: number | null;
  /** the result as a share of revenue; null with no revenue */
  margin: number | null;
}

export function companyKpis(eco: Economy, cohort: Cohort): CompanyKpis {
  const purchases = eco.totals.purchases;
  const net = eco.perPurchase.net;
  const purchasesPerCustomer = cohort.everPremium > 0 ? cohort.purchasesPerVisitor / cohort.everPremium : null;
  return {
    costPerPurchase: purchases >= 0.5 ? (eco.totals.adSpend + eco.totals.fixed) / purchases : null,
    adCostPerPurchase: purchases >= 0.5 && eco.totals.adSpend > 0 ? eco.totals.adSpend / purchases : null,
    valuePer1000: cohort.purchasesPerVisitor * 1000 * net,
    purchasesPerCustomer,
    valuePerCustomer: purchasesPerCustomer === null ? null : purchasesPerCustomer * net,
    margin: eco.totals.revenue > 0 ? eco.totals.profit / eco.totals.revenue : null,
  };
}
