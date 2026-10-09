import { createAdminClient } from "@/lib/supabase/admin";
import type { AnalysisScope } from "./types";

/**
 * The per-user ownership/entitlement layer. Analyses and properties stay
 * shared and cached per property (see requestAnalysis() in pipeline.ts) —
 * this table records which user requested which (shared) analysis and which
 * credit it drew from, so the dashboard can list "my analyses", the report
 * pages can decide what a viewer is entitled to, and account deletion can
 * remove a user's history without ever touching the shared analysis/property/
 * BRF data.
 *
 * There are exactly two entitlements and no locked/preview state:
 *   "full" — bought with a Trygghetspaket credit; the whole report.
 *   "area" — bought with an Områdesanalys credit; the area chapter only.
 * Whoever holds a request row can see exactly what its type grants, always.
 */

export type AnalysisType = AnalysisScope;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AnalysisRequestRecord {
  id: string;
  userId: string;
  analysisId: string;
  propertyId: string;
  analysisType: AnalysisType;
  quotaConsumed: boolean;
  createdAt: string;
}

interface AnalysisRequestRow {
  id: string;
  user_id: string;
  analysis_id: string;
  property_id: string;
  analysis_type: AnalysisType;
  quota_consumed: boolean;
  created_at: string;
}

function mapRow(row: AnalysisRequestRow): AnalysisRequestRecord {
  return {
    id: row.id,
    userId: row.user_id,
    analysisId: row.analysis_id,
    propertyId: row.property_id,
    analysisType: row.analysis_type,
    quotaConsumed: row.quota_consumed,
    createdAt: row.created_at,
  };
}

/**
 * Atomically takes one credit of the given kind from the caller's balance.
 * Returns the new balance, or null if that bucket was already 0 (callers
 * must treat null as "no credit left" and reject the request).
 */
export async function consumeCredit(userId: string, kind: AnalysisType): Promise<number | null> {
  const { data, error } = await createAdminClient().rpc("consume_credit", {
    p_user_id: userId,
    p_kind: kind,
  });
  if (error) throw new Error(`consumeCredit failed: ${error.message}`);
  return data as number | null;
}

/** Gives one credit of the given kind back (a failed analysis must not cost the customer anything). */
export async function refundCredit(userId: string, kind: AnalysisType): Promise<void> {
  const { error } = await createAdminClient().rpc("refund_credit", {
    p_user_id: userId,
    p_kind: kind,
  });
  if (error) throw new Error(`refundCredit failed: ${error.message}`);
}

export async function recordAnalysisRequest(input: {
  userId: string;
  analysisId: string;
  propertyId: string;
  analysisType: AnalysisType;
  quotaConsumed: boolean;
}): Promise<AnalysisRequestRecord> {
  const { data, error } = await createAdminClient()
    .from("analysis_requests")
    .insert({
      user_id: input.userId,
      analysis_id: input.analysisId,
      property_id: input.propertyId,
      analysis_type: input.analysisType,
      quota_consumed: input.quotaConsumed,
    })
    .select("*")
    .single();
  if (error) throw new Error(`recordAnalysisRequest failed: ${error.message}`);
  return mapRow(data as AnalysisRequestRow);
}

export interface OwnedAnalysisSummary {
  requestId: string;
  analysisId: string;
  propertyId: string;
  address: string;
  status: "pending" | "complete" | "failed";
  analysisType: AnalysisType;
  requestedAt: string;
}

/**
 * The user's own analyses, newest request first — the dashboard's only read
 * path for "my analyses." Resolves each ownership row to its property's
 * LATEST analysis version rather than the version pinned at request time:
 * "Update analysis" (rerunAnalysisForProperty, used by both the report
 * page's existing button and the BRF-upload flow) creates a new version
 * without writing a new analysis_requests row, so pinning to the original
 * analysis_id would freeze the dashboard card on stale data after an update.
 *
 * Which versions count depends on the request: a "full" request resolves to
 * the latest *full* analysis (an area-only version is not a complete report
 * and must never be what a full owner's card opens), an "area" request to
 * the latest of either kind.
 *
 * A property bought both ways (area first, then full) is listed once, as
 * the full analysis — the area analysis is part of it.
 *
 * A finished full version that no reviewer has released yet (an update that
 * waits for review) does not replace a released one: the card keeps opening
 * the report the customer can already read until the new one is released.
 */
export async function listAnalysisRequestsForUser(userId: string): Promise<OwnedAnalysisSummary[]> {
  const client = createAdminClient();
  const { data: requests, error: requestsError } = await client
    .from("analysis_requests")
    .select("id, analysis_id, analysis_type, created_at, property_id, refunded_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (requestsError) throw new Error(`listAnalysisRequestsForUser failed: ${requestsError.message}`);

  const rows = requests as Array<{
    id: string;
    analysis_id: string;
    analysis_type: AnalysisType;
    created_at: string;
    property_id: string;
    refunded_at: string | null;
  }>;
  if (rows.length === 0) return [];

  const propertyIds = [...new Set(rows.map((r) => r.property_id))];
  const [{ data: properties, error: propertiesError }, { data: analyses, error: analysesError }] =
    await Promise.all([
      client.from("properties").select("id, address").in("id", propertyIds),
      client
        .from("analyses")
        .select("id, property_id, scope, status, created_at, released_at")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false }),
    ]);
  if (propertiesError) throw new Error(`listAnalysisRequestsForUser failed: ${propertiesError.message}`);
  if (analysesError) throw new Error(`listAnalysisRequestsForUser failed: ${analysesError.message}`);

  const addressByProperty = new Map(
    (properties as Array<{ id: string; address: string }>).map((p) => [p.id, p.address])
  );

  type AnalysisStub = {
    id: string;
    property_id: string;
    scope: AnalysisScope;
    status: "pending" | "complete" | "failed";
    released_at: string | null;
  };
  // Rows arrived ordered newest-created first, so the first one seen per
  // (property, scope-kind) is the latest version of that kind.
  const latestAnyByProperty = new Map<string, AnalysisStub>();
  const latestFullByProperty = new Map<string, AnalysisStub>();
  const latestReleasedFullByProperty = new Map<string, AnalysisStub>();
  for (const a of analyses as AnalysisStub[]) {
    if (!latestAnyByProperty.has(a.property_id)) latestAnyByProperty.set(a.property_id, a);
    if (a.scope === "full" && !latestFullByProperty.has(a.property_id)) latestFullByProperty.set(a.property_id, a);
    if (a.scope === "full" && a.status === "complete" && a.released_at && !latestReleasedFullByProperty.has(a.property_id)) {
      latestReleasedFullByProperty.set(a.property_id, a);
    }
  }
  const fullCardFor = (propertyId: string): AnalysisStub | undefined => {
    const latest = latestFullByProperty.get(propertyId);
    const released = latestReleasedFullByProperty.get(propertyId);
    return latest && latest.status === "complete" && !latest.released_at && released ? released : latest;
  };

  const analysisById = new Map((analyses as AnalysisStub[]).map((a) => [a.id, a]));
  // A refunded request no longer entitles its owner to anything, so it never
  // supersedes (or is superseded by) a live one and is pinned to the failed
  // analysis it belongs to rather than to whatever newer version exists.
  const fullPropertyIds = new Set(
    rows.filter((r) => r.analysis_type === "full" && !r.refunded_at).map((r) => r.property_id)
  );

  return rows
    .filter((row) => row.refunded_at || row.analysis_type === "full" || !fullPropertyIds.has(row.property_id))
    .map((row) => {
      const analysis = row.refunded_at
        ? analysisById.get(row.analysis_id)
        : row.analysis_type === "full"
          ? fullCardFor(row.property_id)
          : latestAnyByProperty.get(row.property_id);
      const address = addressByProperty.get(row.property_id);
      if (!analysis || !address) return null;
      return {
        requestId: row.id,
        analysisId: analysis.id,
        propertyId: row.property_id,
        address,
        status: analysis.status,
        analysisType: row.analysis_type,
        requestedAt: row.created_at,
      } satisfies OwnedAnalysisSummary;
    })
    .filter((row): row is OwnedAnalysisSummary => row !== null);
}

/**
 * The user's best entitlement for this property: "full" beats "area", and
 * null means they never bought an analysis of it. Analyses are shared/cached
 * per property and rerunAnalysisForProperty (the "Update analysis" button and
 * the BRF-report upload) creates a new analyses row for that same property
 * without writing a matching analysis_requests row — so entitlement is
 * resolved per property, never by exact analysis_id, or a customer's own
 * freshly regenerated report would look unpaid the moment it's rerun.
 */
export async function getBestEntitlementForProperty(
  userId: string,
  propertyId: string
): Promise<AnalysisType | null> {
  if (!UUID_RE.test(propertyId)) return null;
  const { data, error } = await createAdminClient()
    .from("analysis_requests")
    .select("analysis_type")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .is("refunded_at", null);
  if (error) throw new Error(`getBestEntitlementForProperty failed: ${error.message}`);
  const types = ((data ?? []) as Array<{ analysis_type: AnalysisType }>).map((r) => r.analysis_type);
  if (types.includes("full")) return "full";
  if (types.includes("area")) return "area";
  return null;
}

/**
 * Gate for everything that reads or builds on the *whole* analysis of a
 * property — the viewing guide, the BRF annual-report upload. An area-only
 * owner has no claim on any of it.
 */
export async function hasFullEntitlementForProperty(userId: string, propertyId: string): Promise<boolean> {
  return (await getBestEntitlementForProperty(userId, propertyId)) === "full";
}

/**
 * Refunds every credit-consuming request tied to this analysis — called when
 * the pipeline can't gather the data the report needs after all retries/
 * fallbacks and the analysis is marked failed instead of complete. A shared
 * (cached-per-property) analysis can have more than one requester; each gets
 * their own credit back through the atomic refund_credit RPC (mirrors
 * consume_credit). Requests that never consumed a credit (quotaConsumed=false
 * — the dev-admin bypass, or a property the user had already paid for) are
 * skipped, nothing to refund.
 */
export async function refundAnalysisRequestsQuota(analysisId: string): Promise<void> {
  const client = createAdminClient();
  // Claim the unrefunded rows first (one atomic UPDATE ... RETURNING), so two
  // concurrent calls can never both refund the same request.
  const { data, error } = await client
    .from("analysis_requests")
    .update({ refunded_at: new Date().toISOString() })
    .eq("analysis_id", analysisId)
    .eq("quota_consumed", true)
    .is("refunded_at", null)
    .select("id, user_id, analysis_type");
  if (error) throw new Error(`refundAnalysisRequestsQuota failed: ${error.message}`);

  const rows = data as Array<{ id: string; user_id: string; analysis_type: AnalysisType }>;
  for (const row of rows) {
    try {
      await refundCredit(row.user_id, row.analysis_type);
    } catch (refundErr) {
      // Put the claim back so the failed refund can be retried, not lost.
      await client.from("analysis_requests").update({ refunded_at: null }).eq("id", row.id);
      throw new Error(
        `refundAnalysisRequestsQuota RPC failed for user ${row.user_id}: ${
          refundErr instanceof Error ? refundErr.message : String(refundErr)
        }`
      );
    }
  }
}

/**
 * True if the user has a refunded request for exactly this analysis — what
 * lets them still open the failed analysis's own page ("we couldn't complete
 * it, your credit was returned") after the refund took their entitlement away.
 */
export async function hasRefundedRequestForAnalysis(userId: string, analysisId: string): Promise<boolean> {
  if (!UUID_RE.test(analysisId)) return false;
  const { data, error } = await createAdminClient()
    .from("analysis_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("analysis_id", analysisId)
    .not("refunded_at", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`hasRefundedRequestForAnalysis failed: ${error.message}`);
  return data !== null;
}

/**
 * True if this user has ever requested an analysis of this property — the
 * minimal ownership check for routes that only expose version metadata, not
 * report content.
 */
export async function hasAnyAnalysisRequestForProperty(userId: string, propertyId: string): Promise<boolean> {
  return (await getBestEntitlementForProperty(userId, propertyId)) !== null;
}

/** Deletes one ownership row (the user's copy in "my analyses"); never touches the shared analysis/property row. */
export async function deleteAnalysisRequest(userId: string, requestId: string): Promise<boolean> {
  if (!UUID_RE.test(requestId)) return false;
  const { data, error } = await createAdminClient()
    .from("analysis_requests")
    .delete()
    .eq("id", requestId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`deleteAnalysisRequest failed: ${error.message}`);
  return data !== null;
}

/**
 * How many analyses of each kind the account holds. A Trygghetspaket
 * analysis is three analyses of one property — BRF, area and hidden costs —
 * so it counts once in each; an Områdesanalys counts only as an area
 * analysis. Failed analyses (whose credit is refunded) are not counted.
 */
export interface AnalysisCounts {
  total: number;
  brf: number;
  area: number;
  hiddenCosts: number;
}

export function countAnalyses(owned: Array<Pick<OwnedAnalysisSummary, "analysisType" | "status">>): AnalysisCounts {
  const counts: AnalysisCounts = { total: 0, brf: 0, area: 0, hiddenCosts: 0 };
  for (const a of owned) {
    if (a.status === "failed") continue;
    counts.total += 1;
    counts.area += 1;
    if (a.analysisType === "full") {
      counts.brf += 1;
      counts.hiddenCosts += 1;
    }
  }
  return counts;
}

export interface ProfileSummary {
  /** Unused analyses the account can still start. */
  credits: { full: number; area: number };
  /** Analyses the account already holds, by kind. */
  analyses: AnalysisCounts;
  memberSince: string;
}

export async function getProfileSummary(userId: string): Promise<ProfileSummary | null> {
  const client = createAdminClient();
  const [{ data: profile, error: profileError }, owned] = await Promise.all([
    client
      .from("profiles")
      .select("full_analyses_remaining, area_analyses_remaining, created_at")
      .eq("id", userId)
      .maybeSingle(),
    listAnalysisRequestsForUser(userId),
  ]);
  if (profileError) throw new Error(`getProfileSummary failed: ${profileError.message}`);
  if (!profile) return null;

  const row = profile as {
    full_analyses_remaining: number;
    area_analyses_remaining: number;
    created_at: string;
  };

  return {
    credits: { full: row.full_analyses_remaining, area: row.area_analyses_remaining },
    analyses: countAnalyses(owned),
    memberSince: row.created_at,
  };
}
