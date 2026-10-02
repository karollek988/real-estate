import { NextResponse } from "next/server";
import { listAnalysisRequestsForUser } from "@/lib/analysis/ownership";
import { requireUser } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/profile/analyses — the signed-in user's own analyses, newest
 * request first. Each full analysis also carries the state of its
 * person-reviewed BRF analysis (lib/brf/reviews.ts), so the dashboard can say
 * whether it is still being reviewed and when it will be ready.
 */
export async function GET() {
  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const analyses = await listAnalysisRequestsForUser(user.id);
    const fullPropertyIds = [...new Set(analyses.filter((a) => a.analysisType === "full").map((a) => a.propertyId))];
    const reviews = new Map<string, { status: string; dueAt: string; publishedAt: string | null; published: unknown }>();
    if (fullPropertyIds.length > 0) {
      const { data, error } = await createAdminClient()
        .from("brf_reviews")
        .select("property_id, status, due_at, published_at, published")
        .in("property_id", fullPropertyIds);
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as Array<{ property_id: string; status: string; due_at: string; published_at: string | null; published: unknown }>) {
        reviews.set(r.property_id, { status: r.status, dueAt: r.due_at, publishedAt: r.published_at, published: r.published });
      }
    }

    return NextResponse.json({
      analyses: analyses.map((a) => {
        const review = a.analysisType === "full" ? reviews.get(a.propertyId) : undefined;
        return {
          ...a,
          brfReview: review
            ? {
                // "published" as soon as customers can read figures, even while a newer report is being reviewed.
                status: review.published ? "published" : review.status === "not_applicable" ? "not_applicable" : "pending",
                dueAt: review.status === "pending" ? review.dueAt : null,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/profile/analyses failed:", err);
    return NextResponse.json(
      { error: { code: "internal_error", message: "Could not load your analyses." } },
      { status: 500 }
    );
  }
}
