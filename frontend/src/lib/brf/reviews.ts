import { createAdminClient } from "@/lib/supabase/admin";
import { EMPTY_BRF_FIGURES, parseBrfFigures, type BrfFigures } from "./figures";

/**
 * The person-reviewed BRF analysis (supabase/migrations/20261002000200_brf_reviews.sql).
 *
 * The rest of the report is automatic and shown the moment the analysis is
 * done. The BRF analysis is different: a Köpanalys reviewer reads the
 * association's annual report, records its figures in the review console
 * (/admin/brf), and publishes them — within 24 hours of the purchase. The
 * report shows "under review, ready by <due>" until then.
 *
 * One review per property. A new annual report arriving after publication
 * (uploaded by the customer or by the reviewer) opens a new review round with
 * a new 24-hour deadline; the earlier published figures stay visible until the
 * new ones are published.
 */

export const BRF_REVIEW_HOURS = 24;

export type BrfReviewStatus = "pending" | "published" | "not_applicable";

export interface BrfReviewRecord {
  propertyId: string;
  status: BrfReviewStatus;
  brfReportId: string | null;
  draft: BrfFigures;
  published: BrfFigures | null;
  publishedReportId: string | null;
  requestedAt: string;
  dueAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BrfReviewRow {
  property_id: string;
  status: BrfReviewStatus;
  brf_report_id: string | null;
  draft: Record<string, unknown> | null;
  published: Record<string, unknown> | null;
  published_report_id: string | null;
  requested_at: string;
  due_at: string;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: BrfReviewRow): BrfReviewRecord {
  return {
    propertyId: row.property_id,
    status: row.status,
    brfReportId: row.brf_report_id,
    // Stored JSON is re-validated on read so a hand-edited row can never put an
    // implausible figure in front of a customer.
    draft: row.draft ? parseBrfFigures(row.draft).figures : { ...EMPTY_BRF_FIGURES },
    published: row.published ? parseBrfFigures(row.published).figures : null,
    publishedReportId: row.published_report_id,
    requestedAt: row.requested_at,
    dueAt: row.due_at,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dueFrom(start: Date): string {
  return new Date(start.getTime() + BRF_REVIEW_HOURS * 60 * 60 * 1000).toISOString();
}

export async function getBrfReview(propertyId: string): Promise<BrfReviewRecord | null> {
  const { data, error } = await createAdminClient()
    .from("brf_reviews")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) throw new Error(`getBrfReview failed: ${error.message}`);
  return data ? mapRow(data as BrfReviewRow) : null;
}

export type EnsureReviewReason = "purchase" | "document" | "report_view";

/**
 * Makes sure a review exists for this property, and opens a new review round
 * when a different annual report arrives after an earlier one was published.
 * `opened` is true whenever this call created or reopened a review — that is
 * when the team needs to hear about it (lib/brf/notify.ts).
 */
export async function ensureBrfReview(
  propertyId: string,
  reason: EnsureReviewReason,
  brfReportId: string | null = null
): Promise<{ review: BrfReviewRecord; opened: boolean }> {
  const client = createAdminClient();
  const now = new Date();

  const { data: inserted, error: insertError } = await client
    .from("brf_reviews")
    .upsert(
      {
        property_id: propertyId,
        status: "pending",
        brf_report_id: brfReportId,
        requested_at: now.toISOString(),
        due_at: dueFrom(now),
      },
      { onConflict: "property_id", ignoreDuplicates: true }
    )
    .select("*");
  if (insertError) throw new Error(`ensureBrfReview failed: ${insertError.message}`);
  if (inserted && inserted.length > 0) {
    return { review: mapRow(inserted[0] as BrfReviewRow), opened: true };
  }

  const existing = await getBrfReview(propertyId);
  if (!existing) throw new Error("ensureBrfReview failed: review vanished after insert conflict");

  if (reason !== "document" || !brfReportId || brfReportId === existing.brfReportId) {
    return { review: existing, opened: false };
  }

  // A different annual report: review it. A pending round keeps its deadline;
  // a finished one is reopened with a new 24 hours.
  const reopen = existing.status !== "pending";
  const patch: Record<string, unknown> = { brf_report_id: brfReportId, updated_at: now.toISOString() };
  if (reopen) {
    patch.status = "pending";
    patch.requested_at = now.toISOString();
    patch.due_at = dueFrom(now);
  }
  const { data: updated, error: updateError } = await client
    .from("brf_reviews")
    .update(patch)
    .eq("property_id", propertyId)
    .select("*")
    .single();
  if (updateError) throw new Error(`ensureBrfReview failed: ${updateError.message}`);
  return { review: mapRow(updated as BrfReviewRow), opened: reopen };
}

export async function saveBrfReviewDraft(propertyId: string, draft: BrfFigures): Promise<BrfReviewRecord> {
  const { data, error } = await createAdminClient()
    .from("brf_reviews")
    .update({ draft, updated_at: new Date().toISOString() })
    .eq("property_id", propertyId)
    .select("*")
    .single();
  if (error) throw new Error(`saveBrfReviewDraft failed: ${error.message}`);
  return mapRow(data as BrfReviewRow);
}

/** Publishes the figures to every customer who owns the full analysis of this property. */
export async function publishBrfReview(
  propertyId: string,
  figures: BrfFigures,
  reviewerId: string
): Promise<BrfReviewRecord> {
  const current = await getBrfReview(propertyId);
  if (!current) throw new Error("publishBrfReview failed: no review for this property");
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("brf_reviews")
    .update({
      status: "published",
      draft: figures,
      published: figures,
      published_report_id: current.brfReportId,
      published_at: now,
      published_by: reviewerId,
      updated_at: now,
    })
    .eq("property_id", propertyId)
    .select("*")
    .single();
  if (error) throw new Error(`publishBrfReview failed: ${error.message}`);
  return mapRow(data as BrfReviewRow);
}

/** For a home that turns out to have no housing association (a freehold house, say). */
export async function markBrfReviewNotApplicable(propertyId: string, reviewerId: string): Promise<BrfReviewRecord> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("brf_reviews")
    .update({ status: "not_applicable", published_at: now, published_by: reviewerId, updated_at: now })
    .eq("property_id", propertyId)
    .select("*")
    .single();
  if (error) throw new Error(`markBrfReviewNotApplicable failed: ${error.message}`);
  return mapRow(data as BrfReviewRow);
}

export interface BrfReviewListItem extends BrfReviewRecord {
  address: string;
  housingAssociation: string | null;
  /** How many customers (non-refunded full requests) are waiting on this review. */
  customerCount: number;
}

/** The review queue: open reviews first (soonest deadline first), then the most recently published. */
export async function listBrfReviews(limit = 200): Promise<BrfReviewListItem[]> {
  const client = createAdminClient();
  const { data, error } = await client
    .from("brf_reviews")
    .select("*, property:properties(address, attributes)")
    .order("due_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listBrfReviews failed: ${error.message}`);

  const rows = (data ?? []) as Array<BrfReviewRow & { property: { address: string; attributes: Record<string, unknown> } | null }>;
  const propertyIds = rows.map((r) => r.property_id);
  const counts = new Map<string, number>();
  if (propertyIds.length > 0) {
    const { data: requests, error: requestsError } = await client
      .from("analysis_requests")
      .select("property_id, user_id")
      .in("property_id", propertyIds)
      .eq("analysis_type", "full")
      .is("refunded_at", null);
    if (requestsError) throw new Error(`listBrfReviews failed: ${requestsError.message}`);
    const users = new Map<string, Set<string>>();
    for (const r of (requests ?? []) as Array<{ property_id: string; user_id: string }>) {
      if (!users.has(r.property_id)) users.set(r.property_id, new Set());
      users.get(r.property_id)!.add(r.user_id);
    }
    for (const [id, set] of users) counts.set(id, set.size);
  }

  const items = rows.map((row) => {
    const attrs = row.property?.attributes ?? {};
    const brfName = typeof attrs.housing_association === "string" ? attrs.housing_association : null;
    return {
      ...mapRow(row),
      address: row.property?.address ?? "(okänd adress)",
      housingAssociation: brfName,
      customerCount: counts.get(row.property_id) ?? 0,
    };
  });

  const open = items.filter((i) => i.status === "pending");
  const done = items
    .filter((i) => i.status !== "pending")
    .sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt));
  return [...open, ...done];
}
