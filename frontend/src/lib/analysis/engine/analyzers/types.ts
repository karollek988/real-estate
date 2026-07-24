import type {
  DataSourceReport,
  DecisionFactorResult,
  ExtractedProperty,
  PropertyRecord,
} from "../../types";

export interface AnalyzerContext {
  property: PropertyRecord;
  extracted: ExtractedProperty;
  /** extracted.attributes merged with property.attributes (property wins) — the full fact set collected so far. */
  attributes: Record<string, unknown>;
  dataSources: DataSourceReport[];
}

/**
 * A single Decision Engine analyzer — one independent axis of judgment
 * (Price, Area, Housing Association, ...). Each is a pure function of the
 * property's collected facts; add a new one by implementing this interface
 * in its own module and registering it in analyzers/registry.ts, without
 * touching any other analyzer.
 */
export interface Analyzer {
  id: string;
  label: string;
  /** Relative weight among substantive analyzers in the overall Decision Score — see registry.ts (weights sum to 1.0 there). */
  weight: number;
  analyze(ctx: AnalyzerContext): DecisionFactorResult;
}
