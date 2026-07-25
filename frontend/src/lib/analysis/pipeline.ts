import { after } from "next/server";
import type { AnalysisRecord, ExtractedProperty, FieldProvenance, PropertyRecord } from "./types";
import { extractFromHemnetUrl } from "./listing/hemnet";
import { extractFromManualFields, type ManualListingFields } from "./listing/manual";
import { normalizedPropertyKey } from "./normalize";
import { getProviders } from "./providers/registry";
import type { DataProvider, PropertyEnrichment, ProviderResult } from "./providers/types";
import { buildAnalysis, ENGINE_VERSION } from "./engine/buildAnalysis";
import { applyProtectedIdentityFields } from "./identityTrust";
import { recordFieldProvenance } from "./providers/providerConfidence";
import {
  completeAnalysis,
  failAnalysis,
  findPropertyByHemnetUrl,
  findPropertyById,
  findPropertyByKey,
  insertPendingAnalysis,
  insertProperty,
  latestCompleteAnalysis,
  updateProperty,
} from "./store";

/**
 * The analysis pipeline:
 *
 *   input (Hemnet URL / manual details)
 *     → extract property facts
 *     → upsert property (each property exists exactly once)
 *     → cache check (fresh analysis? return it — stale? flag it)
 *     → run data providers (real + placeholders)
 *     → build analysis report
 *     → persist as a new immutable analysis version
 */

/** Analyses younger than this are served from cache instead of re-running. */
export const FRESH_ANALYSIS_MAX_AGE_DAYS = 7;

export type AnalysisRequestInput =
  | { kind: "hemnet"; url: string }
  | { kind: "manual"; fields: ManualListingFields };

export interface AnalysisRequestResult {
  property: PropertyRecord;
  analysis: AnalysisRecord;
  /** True when an existing analysis was returned instead of running the pipeline. */
  cached: boolean;
  /** True when the returned cached analysis is older than the freshness window. */
  stale: boolean;
  ageDays: number;
}

export function analysisAgeDays(analysis: Pick<AnalysisRecord, "createdAt">): number {
  return Math.floor((Date.now() - new Date(analysis.createdAt).getTime()) / 86_400_000);
}

export async function requestAnalysis(
  input: AnalysisRequestInput,
  options: { force?: boolean } = {}
): Promise<AnalysisRequestResult> {
  const extracted =
    input.kind === "hemnet"
      ? extractFromHemnetUrl(input.url)
      : extractFromManualFields(input.fields);

  const property = await upsertProperty(extracted);

  if (!options.force) {
    const latest = await latestCompleteAnalysis(property.id);
    // A cached analysis from a different engine version was produced by
    // code that may since have changed how BRFs are matched, how identity
    // fields are trusted, or how financial data is validated — it must
    // never be served as if it reflects the current pipeline (End-to-End
    // Truth Audit fix #3). Treat a version mismatch exactly like no cache.
    if (latest && latest.engineVersion === ENGINE_VERSION) {
      const ageDays = analysisAgeDays(latest);
      return {
        property,
        analysis: latest,
        cached: true,
        stale: ageDays >= FRESH_ANALYSIS_MAX_AGE_DAYS,
        ageDays,
      };
    }
  }

  const pending = await startPipelineInBackground(property, extracted);
  return { property, analysis: pending, cached: false, stale: false, ageDays: 0 };
}

/** Re-runs the pipeline for an existing property, creating a new analysis version. */
export async function rerunAnalysisForProperty(
  propertyId: string
): Promise<AnalysisRequestResult | null> {
  const property = await findPropertyById(propertyId);
  if (!property) return null;

  const extracted: ExtractedProperty = {
    address: property.address,
    municipality: property.municipality,
    postalCode: property.postalCode,
    propertyType: property.propertyType,
    apartmentNumber: property.apartmentNumber,
    floor: property.floor,
    rooms: typeof property.attributes.rooms === "number" ? property.attributes.rooms : null,
    hemnetUrl: property.hemnetUrl,
    attributes: property.attributes,
  };

  const pending = await startPipelineInBackground(property, extracted);
  return { property, analysis: pending, cached: false, stale: false, ageDays: 0 };
}

/**
 * Creates the pending analysis row (fast — a single insert) and returns it
 * immediately, then keeps running the actual pipeline (provider calls,
 * report building) in the background without the caller awaiting it.
 *
 * Providers can take tens of seconds; a request handler that awaited the
 * full pipeline left the browser's fetch() unresolved that whole time, so
 * the client never navigated to /analyzing until the analysis was already
 * done — the loading experience never had a chance to render. Returning as
 * soon as the pending row exists lets the client navigate to /analyzing
 * right away and poll GET /api/analyses/:id (already implemented) for the
 * real completion.
 *
 * On Vercel's serverless runtime the function can be frozen the instant the
 * HTTP response is sent — a bare detached promise here isn't guaranteed to
 * keep running (confirmed in production: some analyses got stuck in
 * "pending" forever with no error, killed mid-pipeline). `after()` tells
 * the platform to keep this invocation alive until the callback settles,
 * while still letting the response return immediately.
 */
async function startPipelineInBackground(
  property: PropertyRecord,
  extracted: ExtractedProperty
): Promise<AnalysisRecord> {
  const pending = await insertPendingAnalysis(property.id, ENGINE_VERSION);
  after(() =>
    runPipeline(pending.id, property, extracted).catch((err) => {
      console.error(`Background analysis pipeline failed for analysis ${pending.id}:`, err);
    })
  );
  return pending;
}

/**
 * Each property exists exactly once: match by Hemnet URL first, then by the
 * normalized address key; insert otherwise. On a match, fields the existing
 * row is missing are backfilled from the new input.
 */
async function upsertProperty(extracted: ExtractedProperty): Promise<PropertyRecord> {
  const key = normalizedPropertyKey(extracted);

  let existing =
    (extracted.hemnetUrl ? await findPropertyByHemnetUrl(extracted.hemnetUrl) : null) ??
    (await findPropertyByKey(key));

  if (!existing) {
    existing = await insertProperty(extracted, key);
    if (existing) return existing;
    // Concurrent insert won the race — fetch what it created.
    existing =
      (extracted.hemnetUrl ? await findPropertyByHemnetUrl(extracted.hemnetUrl) : null) ??
      (await findPropertyByKey(key));
    if (!existing) throw new Error("upsertProperty: property vanished after insert conflict");
    return existing;
  }

  // Backfill fields the stored property is missing from this submission.
  const patch: Parameters<typeof updateProperty>[1] = {};
  if (extracted.hemnetUrl && existing.hemnetUrl !== extracted.hemnetUrl) {
    patch.hemnetUrl = extracted.hemnetUrl;
  }
  if (extracted.propertyType && !existing.propertyType) patch.propertyType = extracted.propertyType;
  if (extracted.apartmentNumber && !existing.apartmentNumber) {
    patch.apartmentNumber = extracted.apartmentNumber;
  }
  if (extracted.floor !== null && existing.floor === null) patch.floor = extracted.floor;
  const mergedAttributes = { ...extracted.attributes, ...existing.attributes };
  if (JSON.stringify(mergedAttributes) !== JSON.stringify(existing.attributes)) {
    patch.attributes = mergedAttributes;
  }

  return Object.keys(patch).length > 0 ? updateProperty(existing.id, patch) : existing;
}

/**
 * Providers run sequentially (each may enrich the property for the next —
 * see the comment on ALL_PROVIDERS in registry.ts), so a single provider
 * that never resolves (a hung fetch with no internal timeout, a dead
 * upstream API) blocks every provider after it forever. Confirmed in
 * production: an analysis stuck in "pending" for 9+ hours with no error
 * ever recorded, because the code never got past the hung `await`. This
 * bounds every provider call so the pipeline can always finish (or record
 * a per-provider error and move on) within a predictable time, regardless
 * of what an individual provider implementation does internally.
 */
const PROVIDER_TIMEOUT_MS = 25_000;

async function withProviderTimeout(
  provider: DataProvider,
  property: PropertyRecord,
  extracted: ExtractedProperty
): Promise<ProviderResult> {
  return Promise.race([
    provider.collect({ extracted, property }),
    new Promise<ProviderResult>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Provider "${provider.id}" timed out after ${PROVIDER_TIMEOUT_MS}ms`)),
        PROVIDER_TIMEOUT_MS
      )
    ),
  ]);
}

async function runPipeline(
  pendingId: string,
  property: PropertyRecord,
  extracted: ExtractedProperty
): Promise<AnalysisRecord> {
  try {
    const results: ProviderResult[] = [];
    const enrichment: PropertyEnrichment = {};
    const attributesPatch: Record<string, unknown> = {};
    // Per-field provenance (source/confidence/timestamp), recorded at the
    // same choke point as attributesPatch below — see providerConfidence.ts.
    let fieldProvenance: FieldProvenance = property.fieldProvenance ?? {};
    // Kept in sync after every provider (not just written to the DB once at
    // the end) so a later provider in the same run — OSM/SCB/SMHI needing
    // coordinates or the canonical municipality — sees what geocoding just
    // found, instead of only the pre-run property. One DB write still
    // happens after the loop; this is purely in-memory sequencing.
    let currentProperty = property;

    for (const provider of getProviders()) {
      let result: ProviderResult;
      try {
        result = await withProviderTimeout(provider, currentProperty, extracted);
      } catch (err) {
        result = {
          source: {
            id: provider.id,
            name: provider.name,
            kind: provider.kind,
            status: "error",
            fields: [],
            detail: err instanceof Error ? err.message : String(err),
          },
          data: {},
        };
      }
      results.push(result);
      if (result.propertyPatch) {
        Object.assign(enrichment, result.propertyPatch);
        currentProperty = { ...currentProperty, ...result.propertyPatch };
      }
      // Only a source that actually found data may write attribute values —
      // never merge data from a not_connected/error/no_data result, even if
      // it accidentally included some.
      if (result.source.status === "ok") {
        const data = applyProtectedIdentityFields(result.data, currentProperty.attributes, provider.id);
        Object.assign(attributesPatch, data);
        currentProperty = { ...currentProperty, attributes: { ...currentProperty.attributes, ...data } };
        fieldProvenance = recordFieldProvenance(fieldProvenance, Object.keys(data), provider.id);
      }
    }

    let enriched = property;
    const hasEnrichment = Object.keys(enrichment).length > 0;
    const hasAttributes = Object.keys(attributesPatch).length > 0;
    if (hasEnrichment || hasAttributes) {
      // A geocoded municipality canonicalizes the dedupe key (URL slugs carry
      // genitive/ASCII-folded names like "stockholms"), so URL- and
      // manual-entry submissions of the same property converge on one row.
      const normalizedKey = enrichment.municipality
        ? normalizedPropertyKey({
            address: property.address,
            municipality: enrichment.municipality,
            apartmentNumber: property.apartmentNumber,
          })
        : undefined;
      enriched = await updateProperty(property.id, {
        ...enrichment,
        normalizedKey,
        ...(hasAttributes
          ? { attributes: { ...property.attributes, ...attributesPatch }, fieldProvenance }
          : {}),
      });
    }

    const report = buildAnalysis(enriched, extracted, results);
    return await completeAnalysis(pendingId, report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failAnalysis(pendingId, message).catch(() => {
      // The original pipeline error is the one worth surfacing.
    });
    throw err;
  }
}
