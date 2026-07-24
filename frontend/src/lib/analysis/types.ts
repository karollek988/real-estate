/**
 * Core domain types for the analysis pipeline.
 *
 * The pipeline turns user input (a Hemnet URL or manually entered details)
 * into a persistent property record plus an append-only, versioned analysis.
 */

/** Property facts extracted from user input, before persistence. */
export interface ExtractedProperty {
  /** Street address, e.g. "Dalagatan 30". May include city for manual entry. */
  address: string;
  municipality: string | null;
  postalCode: string | null;
  /** Display form, e.g. "Lägenhet". */
  propertyType: string | null;
  /** Swedish apartment number when known, e.g. "lgh 1203". */
  apartmentNumber: string | null;
  floor: number | null;
  rooms: number | null;
  hemnetUrl: string | null;
  /**
   * Extra extracted facts without dedicated columns (listing id, raw URL
   * slug, user-entered form fields such as living_area/monthly_fee/...).
   */
  attributes: Record<string, unknown>;
}

/**
 * Per-field provenance: which provider populated a given `attributes` key,
 * how confident that source is (providers/providerConfidence.ts), and when.
 * Recorded generically at the pipeline's merge choke point (pipeline.ts) —
 * individual providers don't compute this themselves.
 */
export interface FieldProvenanceEntry {
  source: string;
  confidence: number;
  updatedAt: string;
}
export type FieldProvenance = Record<string, FieldProvenanceEntry>;

/** A persisted row in the `properties` table (camelCased). */
export interface PropertyRecord {
  id: string;
  normalizedKey: string;
  address: string;
  hemnetUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  municipality: string | null;
  postalCode: string | null;
  propertyType: string | null;
  apartmentNumber: string | null;
  floor: number | null;
  attributes: Record<string, unknown>;
  fieldProvenance: FieldProvenance;
  createdAt: string;
  updatedAt: string;
}

/** "real" = an actual integration; "placeholder" = a planned source that is not connected yet. */
export type DataSourceKind = "real" | "placeholder";

export type DataSourceStatus = "ok" | "no_data" | "error" | "not_connected";

/** Per-source outcome recorded on every analysis run. */
export interface DataSourceReport {
  id: string;
  name: string;
  kind: DataSourceKind;
  status: DataSourceStatus;
  /** Field names this source contributed (empty unless status is "ok"). */
  fields: string[];
  detail?: string;
}

/**
 * Structured output of one Decision Engine analyzer (see engine/analyzers/).
 * Persisted in full on every analysis so a future AI report can consume the
 * reasoning, not just the score — the current report UI only reads the 6
 * factors it maps to `insights` (see engine/buildAnalysis.ts).
 */
export interface DecisionFactorResult {
  id: string;
  label: string;
  /** 0-100, or null when there isn't enough real data to compute a score — never a guess. */
  score: number | null;
  /** 0-1. Reflects how much real, connected data backs this factor. */
  confidence: number;
  /** Short status text, e.g. "Excellent", "Insufficient data". */
  status: string;
  explanation: string;
  supportingData: Record<string, unknown>;
  /** Names of data sources/fields that would be needed to score this with more confidence. */
  missingData: string[];
  /** This factor's configured weight in the overall Decision Score (0 for meta-analyzers like Confidence). */
  weight: number;
}

export type InsightTone = "positive" | "neutral";

export interface Insight {
  label: string;
  value: string;
  tone: InsightTone;
  /** True when the backing data sources are not connected yet. */
  pending: boolean;
}

/** The full analysis report persisted as `analyses.result` and rendered by the report page. */
export interface AnalysisReport {
  engineVersion: string;
  generatedAt: string;
  factorsAnalyzed: number;
  property: {
    address: string;
    postalCode: string | null;
    municipality: string | null;
    floor: string | null;
    apartmentNumber: string | null;
    propertyType: string | null;
    rooms: number | null;
    buildingYear: number | null;
    renovationYear: number | null;
    housingAssociation: string | null;
    /** Set when a lower-trust source's housing association name disagreed with the trusted one (see identityTrust.ts) — the disagreement is kept, never silently dropped. */
    housingAssociationConflict: { keptValue: string; rejectedValue: string; rejectedSource: string } | null;
    askingPriceSek: number | null;
    monthlyFeeSek: number | null;
    operatingCostsSek: number | null;
    livingAreaM2: number | null;
    additionalAreaM2: number | null;
    lotAreaM2: number | null;
    pricePerM2Sek: number | null;
    /** This exact address's own most recent recorded sale (Booli /sold, excluded from the comparables pool). */
    previousSalePriceSek: number | null;
    previousSaleDate: string | null;
    mortgageDeed: boolean | null;
    solarPanels: boolean | null;
    fireplace: boolean | null;
    biddingOpen: boolean | null;
    newConstruction: boolean | null;
    energyClass: string | null;
    description: string | null;
    imageUrls: string[];
    floorplanUrls: string[];
    features: string[];
    condition: string | null;
    balcony: boolean | null;
    elevator: boolean | null;
    parking: boolean | null;
    garage: boolean | null;
    storage: boolean | null;
    patio: boolean | null;
    broker: string | null;
    agency: string | null;
    listingDate: string | null;
    ownershipType: string | null;
    objectId: string | null;
  };
  decisionScore: number;
  /** 0-1 — see engine/analyzers/confidence.ts. How much of the full data picture this analysis actually has. */
  overallConfidence: number;
  verdict: string;
  summary: string;
  insights: Insight[];
  /** Full Decision Engine output (Price/Area/HousingAssociation/Market/FutureDevelopment/Negotiation/Risk/Confidence) — feeds the future AI report. */
  decisionFactors: DecisionFactorResult[];
  dataSources: DataSourceReport[];
  dataCompleteness: {
    connectedSources: number;
    totalSources: number;
  };
}

export type AnalysisStatus = "pending" | "complete" | "failed";

/** A persisted row in the `analyses` table (camelCased). */
export interface AnalysisRecord {
  id: string;
  propertyId: string;
  version: number;
  engineVersion: string;
  status: AnalysisStatus;
  decisionScore: number | null;
  report: AnalysisReport | null;
  dataSources: DataSourceReport[];
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}
