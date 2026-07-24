import type { DataSourceReport, ExtractedProperty, PropertyRecord } from "../types";

/** Enrichments a provider may contribute back to the property's dedicated columns. */
export type PropertyEnrichment = Partial<
  Pick<PropertyRecord, "latitude" | "longitude" | "municipality" | "postalCode">
>;

export interface ProviderContext {
  /** Facts extracted from the user's input (URL slug or manual form). */
  extracted: ExtractedProperty;
  /** The persisted property, including enrichments from providers that ran earlier. */
  property: PropertyRecord;
}

export interface ProviderResult {
  /** Outcome report persisted on the analysis (real vs placeholder, ok vs error...). */
  source: DataSourceReport;
  /**
   * Structured data collected from the source, keyed by attribute name. Only
   * include a key when the source actually returned that value — never a
   * default or guess. Merged into `properties.attributes` by the pipeline
   * (later providers in the registry can override earlier ones for the same
   * key, so pick attribute names that don't collide across providers).
   */
  data: Record<string, unknown>;
  /** Optional corrections/enrichments to the property record's dedicated columns (coordinates, municipality, postal code...). */
  propertyPatch?: PropertyEnrichment;
}

/**
 * A pluggable data source. Adding a new source (Booli, SCB, Bolagsverket,
 * Trafiklab, ...) means implementing this interface in its own module and
 * registering it in providers/registry.ts — nothing else changes.
 */
export interface DataProvider {
  id: string;
  name: string;
  kind: "real" | "placeholder";
  collect(ctx: ProviderContext): Promise<ProviderResult>;
}
