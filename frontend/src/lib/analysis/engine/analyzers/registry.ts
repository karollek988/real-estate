import type { Analyzer } from "./types";
import { marketAnalyzer } from "./market";
import { housingAssociationAnalyzer } from "./housingAssociation";
import { riskAnalyzer } from "./risk";
import { futureDevelopmentAnalyzer } from "./futureDevelopment";
import { areaAnalyzer } from "./area";

/**
 * Every fact collector, in the order their factors are stored on the report.
 * The cost calculation ("Boendekalkyl", lib/report/housingCost.ts) needs no
 * collector: it is computed from the property's own listing facts when the
 * report is rendered.
 */
export const analyzers: Analyzer[] = [
  areaAnalyzer,
  marketAnalyzer,
  housingAssociationAnalyzer,
  riskAnalyzer,
  futureDevelopmentAnalyzer,
];
