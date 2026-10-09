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
 * The facts gathered for one part of the report (area, housing association,
 * market, risk, future development — see engine/analyzers/). It is a bag of
 * facts, not a verdict: there is no score, rating or weight anywhere in the
 * report any more. lib/report/build.ts writes the Swedish text from
 * `supportingData`, and `available` says whether the data this part needs
 * could be gathered at all — false means nothing can be said, never a guess.
 */
export interface ReportFactor {
  id: string;
  available: boolean;
  supportingData: Record<string, unknown>;
}

/** The full analysis report persisted as `analyses.result` and rendered by the report page. */
export interface AnalysisReport {
  engineVersion: string;
  generatedAt: string;
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
  /**
   * The facts behind the chapters that need more than the property itself
   * (see ReportFactor). Stored under this name since the first engine version;
   * reports persisted before 2026-10-02 carry extra score fields that
   * legacyReport.ts strips when they are read.
   */
  decisionFactors: ReportFactor[];
  dataSources: DataSourceReport[];
  dataCompleteness: {
    connectedSources: number;
    totalSources: number;
  };
}

export type AnalysisStatus = "pending" | "complete" | "failed";

/**
 * How much a stored analysis contains. A "full" analysis is the complete
 * report; an "area" analysis (the standalone Områdesanalys product) only ever
 * holds the area chapter's data. The scope is what keeps an area-only report
 * out of the full-analysis cache (store.ts's latestCompleteAnalysis).
 */
export type AnalysisScope = "full" | "area";

/**
 * Categorized cause of a "failed" analysis, alongside the free-text `error`.
 * "insufficient_data" is the one customer-facing case (pipeline.ts's
 * InsufficientListingDataError — quota is always refunded for it) and is
 * the only reason the report page shows the reassuring "we couldn't gather
 * enough reliable data" message for; anything else falls back to a plainer
 * generic message rather than promising a refund that may not apply.
 */
export type AnalysisFailureReason = "insufficient_data" | "pipeline_error";

/** A persisted row in the `analyses` table (camelCased). */
export interface AnalysisRecord {
  id: string;
  propertyId: string;
  version: number;
  engineVersion: string;
  scope: AnalysisScope;
  status: AnalysisStatus;
  report: AnalysisReport | null;
  dataSources: DataSourceReport[];
  error: string | null;
  failureReason: AnalysisFailureReason | null;
  createdAt: string;
  completedAt: string | null;
  /**
   * Since when the customer may see this analysis. null = a full report that
   * waits for a Köpanalys reviewer to release it (lib/analysis/release.ts);
   * an Områdesanalys is released the moment it is created.
   */
  releasedAt: string | null;
}
