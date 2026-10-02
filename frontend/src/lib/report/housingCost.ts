import type { AnalysisReport } from "@/lib/analysis/types";
import { listSv, num, sek, sekPerM2 } from "./format";
import { tenureOf, type Tenure } from "./tenure";

/**
 * NOT RENDERED YET. The report's Boendekalkyl chapter is a "lanseras inom
 * kort" placeholder until the Boendekalkyl is finished (decision 2026-10-02,
 * see docs/48). This module is the groundwork for it: the cost rules below
 * were verified, and housingCost.verify.mjs keeps them honest. When the
 * chapter is built, it should also take in the BRF analysis's costs that are
 * easy to miss (lib/brf/interpret.ts → forYou: the buyer's share of the
 * association's debt, the fee after a rate rise, decided fee changes).
 *
 * The "Boendekalkyl" chapter: what the home costs to live in each month, and
 * the costs that come with the purchase and are easy to miss in the listing.
 * It is a calculation from the listing's own facts (price, monthly fee,
 * operating costs) and a handful of published rules — it says nothing about
 * whether the price is right. Computed when the report is rendered, so it needs
 * no stored analysis step and also works for reports stored earlier.
 *
 * Every figure is an estimate with its assumptions written out next to it
 * (`assumptions`), and everything that is NOT in the calculation is listed
 * (`notIncluded`). The rules below were checked on 2026-10-02 against
 * Lantmäteriet (stamp duty) and the mortgage rules in force from 1 April 2026;
 * COST_RULES_AS_OF is shown in the report, and the constants must be reviewed
 * each January and whenever the rules change (see PROJECT_STATE.md).
 */

export const COST_RULES_AS_OF = "oktober 2026";

/** Highest loan as a share of the price when buying (bolånetaket, 90 % from 1 April 2026 — at least 10 % cash down payment). */
export const MAX_LOAN_TO_VALUE = 0.9;

/** Amortization requirement per year, as a share of the loan: 2 % above 70 % of the value, 1 % between 50 and 70 %, none at or below 50 %. */
export function amortizationRate(loanToValue: number): number {
  if (loanToValue > 0.7) return 0.02;
  if (loanToValue > 0.5) return 0.01;
  return 0;
}

/** Illustrative mortgage rates the monthly cost is shown for — the real rate is set by the lender. */
export const INTEREST_SCENARIOS_PCT: readonly number[] = [3, 4, 5];

/** Lagfart for a private person (freehold only): stamp duty on the higher of price and taxeringsvärde, plus the registration fee. */
export const LAGFART_STAMP_DUTY_RATE = 0.015;
export const LAGFART_FEE_SEK = 825;

/** Pantbrev (new mortgage deeds, freehold only): stamp duty on the deed amount, plus a fee per deed. */
export const PANTBREV_STAMP_DUTY_RATE = 0.02;
export const PANTBREV_FEE_PER_DEED_SEK = 375;

export interface CostRow {
  label: string;
  value: string;
  note?: string;
}

export interface InterestScenario {
  ratePct: number;
  interestPerMonthSek: number;
  amortizationPerMonthSek: number;
  /** Fee / operating costs + interest + amortization. */
  totalPerMonthSek: number;
}

export interface HousingCostContent {
  tenure: Tenure;
  askingPriceSek: number | null;
  /** True when the price is known, so the loan-based figures could be calculated. */
  calculable: boolean;
  paragraphs: string[];
  /** The running costs as the listing states them (månadsavgift / driftskostnader). */
  listingMonthlyRows: CostRow[];
  loan: { amountSek: number; downPaymentSek: number; loanToValuePct: number; amortizationPctPerYear: number } | null;
  /** The monthly part that does not depend on the loan (fee, or operating costs / 12). Null when the listing has neither. */
  fixedMonthlySek: number | null;
  scenarios: InterestScenario[];
  /** What has to be paid because of the purchase itself. */
  purchaseRows: CostRow[];
  assumptions: string[];
  notIncluded: string[];
  policyRatePct: number | null;
  /** Lowest and highest monthly total across the scenarios (for the executive summary). */
  summaryRange: { minPerMonthSek: number; maxPerMonthSek: number } | null;
}

/** Lagfart for a purchase price: 1.5 % of the price rounded down to whole thousands, plus the fee. */
export function lagfartSek(priceSek: number): number {
  return Math.floor(priceSek / 1000) * 1000 * LAGFART_STAMP_DUTY_RATE + LAGFART_FEE_SEK;
}

function svPercent(ratePct: number): string {
  return `${ratePct.toLocaleString("sv-SE", { maximumFractionDigits: 2 })} %`;
}

export function buildHousingCost(report: AnalysisReport, attributes: Record<string, unknown> = {}): HousingCostContent {
  const p = report.property;
  const tenure = tenureOf(p);
  const price = p.askingPriceSek !== null && p.askingPriceSek > 0 ? p.askingPriceSek : null;
  const fee = p.monthlyFeeSek;
  const operatingPerMonth = p.operatingCostsSek !== null ? p.operatingCostsSek / 12 : null;
  const policyRatePct = num(attributes.policy_rate_pct);

  const paragraphs: string[] = [];
  const listingMonthlyRows: CostRow[] = [];

  // ── What the listing says about running costs ──
  if (fee !== null) {
    listingMonthlyRows.push({
      label: "Månadsavgift",
      value: `${sek(fee)} per månad`,
      note: "Betalas till föreningen. Vad den täcker (till exempel värme och vatten) varierar mellan föreningar.",
    });
  }
  if (p.operatingCostsSek !== null) {
    listingMonthlyRows.push({
      label: "Driftskostnader",
      value: `${sek(p.operatingCostsSek)} per år`,
      note: `Cirka ${sek(p.operatingCostsSek / 12)} per månad enligt annonsen.`,
    });
  }

  if (price !== null) {
    paragraphs.push(
      `Utgångspriset för ${p.address} är ${sek(price)}` +
        (p.pricePerM2Sek ? `, motsvarande ${sekPerM2(p.pricePerM2Sek)}.` : ".")
    );
  } else {
    paragraphs.push(
      "Inget utgångspris är registrerat för denna bostad, så de kostnader som beror på priset — lån, kontantinsats och avgifter vid köpet — kan inte beräknas. De månadskostnader som annonsen anger visas nedan."
    );
  }

  if (tenure === "cooperative") {
    paragraphs.push(
      fee !== null
        ? `Månadsavgiften till föreningen är ${sek(fee)}. Den täcker föreningens kostnader för bland annat drift, underhåll och lån, och är en del av vad bostaden kostar varje månad utöver ditt eget lån.`
        : "Ingen månadsavgift är registrerad för denna bostadsrätt, vilket gör att den löpande kostnaden inte går att beräkna fullt ut."
    );
  } else if (tenure === "freehold") {
    paragraphs.push(
      p.operatingCostsSek !== null
        ? `Driftskostnaderna anges i annonsen till ${sek(p.operatingCostsSek)} per år. Ett hus har ingen månadsavgift, men kostnader för uppvärmning, vatten, avlopp och sophämtning tillkommer på samma sätt som för andra boenden.`
        : "Annonsen anger inga driftskostnader. Ett hus har ingen månadsavgift till en förening, men kostnader för uppvärmning, vatten, avlopp och sophämtning tillkommer."
    );
  }

  // ── The loan, and what it costs per month ──
  let loan: HousingCostContent["loan"] = null;
  const scenarios: InterestScenario[] = [];
  const fixedMonthly = fee !== null || operatingPerMonth !== null ? (fee ?? 0) + (operatingPerMonth ?? 0) : null;

  if (price !== null) {
    const loanAmount = price * MAX_LOAN_TO_VALUE;
    const amortPct = amortizationRate(MAX_LOAN_TO_VALUE);
    loan = {
      amountSek: loanAmount,
      downPaymentSek: price - loanAmount,
      loanToValuePct: Math.round(MAX_LOAN_TO_VALUE * 100),
      amortizationPctPerYear: amortPct * 100,
    };
    const amortPerMonth = (loanAmount * amortPct) / 12;
    for (const ratePct of INTEREST_SCENARIOS_PCT) {
      const interestPerMonth = (loanAmount * (ratePct / 100)) / 12;
      scenarios.push({
        ratePct,
        interestPerMonthSek: interestPerMonth,
        amortizationPerMonthSek: amortPerMonth,
        totalPerMonthSek: (fixedMonthly ?? 0) + interestPerMonth + amortPerMonth,
      });
    }
    paragraphs.push(
      `Kalkylen utgår från ett lån på ${loan.loanToValuePct} % av priset (${sek(loanAmount)}) och en kontantinsats på ${sek(loan.downPaymentSek)}. ` +
        "Ränta och amortering visas för tre räntenivåer, eftersom räntan på ett verkligt lån sätts av långivaren och varierar mellan banker och över tid." +
        (policyRatePct !== null ? ` Riksbankens styrränta är just nu ${svPercent(policyRatePct)}.` : "")
    );
  }

  // ── What comes with the purchase ──
  const purchaseRows: CostRow[] = [];
  if (loan !== null && price !== null) {
    purchaseRows.push({
      label: "Kontantinsats",
      value: sek(loan.downPaymentSek),
      note: "Minst 10 % av priset måste betalas med eget kapital.",
    });
  }

  const cooperativeRows = (): CostRow[] => [
    {
      label: "Lagfart",
      value: "Tas inte ut",
      note: "Vid köp av en bostadsrätt betalas varken lagfart eller stämpelskatt.",
    },
    {
      label: "Överlåtelse- och pantsättningsavgift",
      value: "Enligt föreningens stadgar",
      note: "Föreningen kan ta ut dessa avgifter (de är begränsade i lag). Vem som betalar framgår av stadgarna.",
    },
  ];
  const freeholdRows = (label: (s: string) => string): CostRow[] => {
    if (price === null || loan === null) return [];
    return [
      {
        label: label("Lagfart"),
        value: sek(lagfartSek(price)),
        note: `${svPercent(LAGFART_STAMP_DUTY_RATE * 100)} av köpeskillingen (eller av taxeringsvärdet om det är högre) plus ${sek(LAGFART_FEE_SEK)} i expeditionsavgift. Beräknat på utgångspriset.`,
      },
      {
        label: label("Pantbrev"),
        value: `Upp till ${sek(loan.amountSek * PANTBREV_STAMP_DUTY_RATE)}`,
        note: `${svPercent(PANTBREV_STAMP_DUTY_RATE * 100)} av beloppet på nya pantbrev plus ${sek(PANTBREV_FEE_PER_DEED_SEK)} per pantbrev. Gäller bara de pantbrev som behöver köpas nya — säljarens befintliga pantbrev kan följa med bostaden. Beloppet gäller om hela lånet kräver nya pantbrev.`,
      },
    ];
  };

  if (tenure === "cooperative") {
    purchaseRows.push(...cooperativeRows());
  } else if (tenure === "freehold") {
    purchaseRows.push(...freeholdRows((s) => s));
  } else {
    purchaseRows.push(
      ...freeholdRows((s) => `${s} (äganderätt, till exempel villa)`),
      ...cooperativeRows().map((r) => ({ ...r, label: r.label === "Lagfart" ? "Lagfart (bostadsrätt)" : r.label }))
    );
  }

  // ── Assumptions and what is left out ──
  const assumptions: string[] = [];
  if (loan !== null) {
    assumptions.push(
      `Lån på ${loan.loanToValuePct} % av utgångspriset — högsta tillåtna belåning vid köp sedan 1 april 2026 (minst 10 % kontantinsats).`,
      `Amortering ${loan.amortizationPctPerYear.toLocaleString("sv-SE")} % av lånet per år — amorteringskravet är 2 % när lånet överstiger 70 % av värdet och 1 % mellan 50 och 70 %.`,
      `Räntorna ${listSv(INTEREST_SCENARIOS_PCT.map((r) => `${r} %`))} är exempel och gäller före ränteavdrag.`
    );
  }
  assumptions.push(`Reglerna för bolån, lagfart och pantbrev är de som gällde ${COST_RULES_AS_OF}.`);
  assumptions.push("Kalkylen är en uppskattning och ett lånebesked från en bank ersätter den inte.");

  const notIncluded: string[] = [
    "Hemförsäkring" + (tenure === "cooperative" ? " (med bostadsrättstillägg)" : ""),
    "El, värme, vatten och bredband om de inte ingår i avgiften",
    tenure === "freehold"
      ? "Kommunal fastighetsavgift, underhåll och renovering av huset"
      : "Extra avgifter från föreningen, till exempel för förråd, parkering eller bredband",
    "Flytt, renovering och inredning",
  ];

  const totals = scenarios.map((s) => s.totalPerMonthSek);
  return {
    tenure,
    askingPriceSek: price,
    calculable: price !== null,
    paragraphs,
    listingMonthlyRows,
    loan,
    fixedMonthlySek: fixedMonthly,
    scenarios,
    purchaseRows,
    assumptions,
    notIncluded,
    policyRatePct,
    summaryRange: totals.length > 0 ? { minPerMonthSek: Math.min(...totals), maxPerMonthSek: Math.max(...totals) } : null,
  };
}
