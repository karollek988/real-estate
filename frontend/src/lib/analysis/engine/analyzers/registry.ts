import type { Analyzer } from "./types";
import { priceAnalyzer } from "./price";
import { marketAnalyzer } from "./market";
import { housingAssociationAnalyzer } from "./housingAssociation";
import { riskAnalyzer } from "./risk";
import { futureDevelopmentAnalyzer } from "./futureDevelopment";
import { negotiationAnalyzer } from "./negotiation";
import { areaAnalyzer } from "./area";

/**
 * The 7 substantive analyzers (everything except the meta Confidence
 * analyzer — see confidence.ts). Weights reflect how directly each axis
 * bears on a purchase decision and must sum to 1.0:
 *
 *   Price                0.25  — the single largest lever on a purchase decision
 *   Market / Housing Association / Risk   0.15 each — major but slower-moving factors
 *   Future Potential / Negotiation / Area  0.10 each — real but secondary factors
 *
 * Add a new analyzer: implement the Analyzer interface in its own module,
 * add it here with a weight, and rebalance the others to keep the sum at
 * 1.0 — nothing else in the engine needs to change.
 */
export const substantiveAnalyzers: Analyzer[] = [
  priceAnalyzer,
  marketAnalyzer,
  housingAssociationAnalyzer,
  riskAnalyzer,
  futureDevelopmentAnalyzer,
  negotiationAnalyzer,
  areaAnalyzer,
];
