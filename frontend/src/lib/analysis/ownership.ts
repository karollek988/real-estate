import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The per-user ownership/entitlement layer. Analyses and properties stay
 * shared and cached per property (see requestAnalysis() in pipeline.ts) —
 * this table records which user requested which (shared) analysis and
 * which quota bucket it drew from, so the profile page can list "my
 * analyses" and account deletion can remove a user's history without ever
 * touching the shared analysis/property/BRF data.
 */

export type AnalysisType = "free" | "premium";

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
 * Atomically decrements the given quota bucket on the caller's profile.
 * Returns the new remaining count, or null if that bucket was already 0
 * (callers must treat null as "quota exhausted" and reject the request).
 */
export async function consumeAnalysisQuota(
  userId: string,
  analysisType: AnalysisType
): Promise<number | null> {
  const { data, error } = await createAdminClient().rpc("consume_analysis_quota", {
    p_user_id: userId,
    p_type: analysisType,
  });
  if (error) throw new Error(`consumeAnalysisQuota failed: ${error.message}`);
  return data as number | null;
}

export async function recordAnalysisRequest(input: {
  userId: string;
  analysisId: string;
  propertyId: string;
  analysisType: AnalysisType;
  quotaConsumed?: boolean;
}): Promise<AnalysisRequestRecord> {
  const { data, error } = await createAdminClient()
    .from("analysis_requests")
    .insert({
      user_id: input.userId,
      analysis_id: input.analysisId,
      property_id: input.propertyId,
      analysis_type: input.analysisType,
      quota_consumed: input.quotaConsumed ?? true,
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
  decisionScore: number | null;
  analysisType: AnalysisType;
  requestedAt: string;
}

/**
 * The user's own analyses, newest request first — the profile's only read
 * path for "my analyses." Resolves each ownership row to its property's
 * LATEST analysis version rather than the version pinned at request time:
 * "Update analysis" (rerunAnalysisForProperty, used by both the report
 * page's existing button and the BRF-upload flow) creates a new version
 * without writing a new analysis_requests row, so pinning to the original
 * analysis_id would freeze the profile card on stale data after an update.
 */
export async function listAnalysisRequestsForUser(userId: string): Promise<OwnedAnalysisSummary[]> {
  const client = createAdminClient();
  const { data: requests, error: requestsError } = await client
    .from("analysis_requests")
    .select("id, analysis_type, created_at, property_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (requestsError) throw new Error(`listAnalysisRequestsForUser failed: ${requestsError.message}`);

  const rows = requests as Array<{
    id: string;
    analysis_type: AnalysisType;
    created_at: string;
    property_id: string;
  }>;
  if (rows.length === 0) return [];

  const propertyIds = [...new Set(rows.map((r) => r.property_id))];
  const [{ data: properties, error: propertiesError }, { data: analyses, error: analysesError }] =
    await Promise.all([
      client.from("properties").select("id, address").in("id", propertyIds),
      client
        .from("analyses")
        .select("id, property_id, status, decision_score, created_at")
        .in("property_id", propertyIds)
        .order("created_at", { ascending: false }),
    ]);
  if (propertiesError) throw new Error(`listAnalysisRequestsForUser failed: ${propertiesError.message}`);
  if (analysesError) throw new Error(`listAnalysisRequestsForUser failed: ${analysesError.message}`);

  const addressByProperty = new Map(
    (properties as Array<{ id: string; address: string }>).map((p) => [p.id, p.address])
  );
  // Rows arrived ordered newest-created first, so the first one seen per
  // property is the latest version.
  const latestAnalysisByProperty = new Map<
    string,
    { id: string; status: "pending" | "complete" | "failed"; decision_score: number | null }
  >();
  for (const a of analyses as Array<{
    id: string;
    property_id: string;
    status: "pending" | "complete" | "failed";
    decision_score: number | null;
  }>) {
    if (!latestAnalysisByProperty.has(a.property_id)) {
      latestAnalysisByProperty.set(a.property_id, a);
    }
  }

  return rows
    .map((row) => {
      const analysis = latestAnalysisByProperty.get(row.property_id);
      const address = addressByProperty.get(row.property_id);
      if (!analysis || !address) return null;
      return {
        requestId: row.id,
        analysisId: analysis.id,
        propertyId: row.property_id,
        address,
        status: analysis.status,
        decisionScore: analysis.decision_score,
        analysisType: row.analysis_type,
        requestedAt: row.created_at,
      } satisfies OwnedAnalysisSummary;
    })
    .filter((row): row is OwnedAnalysisSummary => row !== null);
}

/**
 * True if this user has ever requested a Premium analysis for this property —
 * the gate for Besiktningshjälp (Premium-only feature) and for resolving
 * which analysis an inspection should read from.
 */
export async function findPremiumAnalysisForProperty(
  userId: string,
  propertyId: string
): Promise<{ analysisId: string } | null> {
  const { data, error } = await createAdminClient()
    .from("analysis_requests")
    .select("analysis_id")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .eq("analysis_type", "premium")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findPremiumAnalysisForProperty failed: ${error.message}`);
  const row = data as { analysis_id: string } | null;
  return row ? { analysisId: row.analysis_id } : null;
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

export interface ProfileSummary {
  premiumRemaining: number;
  freeRemaining: number;
  totalAnalyses: number;
  memberSince: string;
  subscriptionStatus: string | null;
  subscriptionTier: string | null;
  subscriptionEnd: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

export async function getProfileSummary(userId: string): Promise<ProfileSummary | null> {
  const client = createAdminClient();
  const [{ data: profile, error: profileError }, { count, error: countError }] = await Promise.all([
    client
      .from("profiles")
      .select(
        "premium_analyses_remaining, free_analyses_remaining, created_at, subscription_status, subscription_tier, subscription_end, current_period_end, stripe_customer_id"
      )
      .eq("id", userId)
      .maybeSingle(),
    client.from("analysis_requests").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (profileError) throw new Error(`getProfileSummary failed: ${profileError.message}`);
  if (countError) throw new Error(`getProfileSummary failed: ${countError.message}`);
  if (!profile) return null;

  const row = profile as {
    premium_analyses_remaining: number;
    free_analyses_remaining: number;
    created_at: string;
    subscription_status: string | null;
    subscription_tier: string | null;
    subscription_end: string | null;
    current_period_end: string | null;
    stripe_customer_id: string | null;
  };

  return {
    premiumRemaining: row.premium_analyses_remaining,
    freeRemaining: row.free_analyses_remaining,
    totalAnalyses: count ?? 0,
    memberSince: row.created_at,
    subscriptionStatus: row.subscription_status,
    subscriptionTier: row.subscription_tier,
    subscriptionEnd: row.subscription_end,
    currentPeriodEnd: row.current_period_end,
    stripeCustomerId: row.stripe_customer_id,
  };
}
