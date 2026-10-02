import type { DataSourceReport, ExtractedProperty, PropertyRecord, ReportFactor } from "../../types";

export interface AnalyzerContext {
  property: PropertyRecord;
  extracted: ExtractedProperty;
  /** extracted.attributes merged with property.attributes (property wins) — the full fact set collected so far. */
  attributes: Record<string, unknown>;
  dataSources: DataSourceReport[];
}

/**
 * Collects the facts one part of the report is written from (area, housing
 * association, market, risk, future development). A pure function of the
 * property's collected facts: it never judges, scores or rates anything — it
 * returns what it found (`supportingData`) and whether that was enough to say
 * anything at all (`available`). Add a new one by implementing this interface
 * in its own module and registering it in analyzers/registry.ts.
 */
export interface Analyzer {
  id: string;
  analyze(ctx: AnalyzerContext): ReportFactor;
}
