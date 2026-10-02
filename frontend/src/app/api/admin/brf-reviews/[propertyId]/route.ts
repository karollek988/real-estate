import { after, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { hasAnyBrfFigure, parseBrfFigures } from "@/lib/brf/figures";
import { getBrfReview, markBrfReviewNotApplicable, publishBrfReview, saveBrfReviewDraft } from "@/lib/brf/reviews";
import { notifyCustomersOfPublishedBrf } from "@/lib/brf/notify";

function errorResponse(status: number, code: string, message: string, details?: string[]) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

/**
 * POST /api/admin/brf-reviews/:propertyId — the review console's actions
 * (reviewers only, lib/auth/admin.ts).
 *
 * Body: { action: "save" | "publish" | "not_applicable", figures?: BrfFigures }
 *  - save:           keep the reviewer's working copy (not visible to customers)
 *  - publish:        show the figures to every customer who owns the full
 *                    analysis, and email them that the BRF analysis is ready
 *  - not_applicable: the home has no housing association
 *
 * Figures are validated against lib/brf/figures.ts on every action, so a
 * typing error (a fee of 69 000 kr/kvm) is refused before it is saved.
 */
export async function POST(request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params;
  const { user, response } = await requireAdmin();
  if (response) return response;

  const review = await getBrfReview(propertyId);
  if (!review) return errorResponse(404, "not_found", "Ingen granskning finns för den här bostaden.");

  let body: { action?: unknown; figures?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "invalid_request", "Request body must be JSON.");
  }

  if (body.action === "not_applicable") {
    const updated = await markBrfReviewNotApplicable(propertyId, user.id);
    return NextResponse.json({ review: updated });
  }

  if (body.action !== "save" && body.action !== "publish") {
    return errorResponse(400, "invalid_request", 'action must be "save", "publish" or "not_applicable".');
  }

  const { figures, errors } = parseBrfFigures(body.figures);
  if (errors.length > 0) {
    return errorResponse(422, "invalid_figures", "Rätta uppgifterna nedan innan du sparar.", errors);
  }

  if (body.action === "save") {
    const updated = await saveBrfReviewDraft(propertyId, figures);
    return NextResponse.json({ review: updated });
  }

  if (!hasAnyBrfFigure(figures)) {
    return errorResponse(422, "empty_review", "Fyll i minst ett nyckeltal eller en kommentar innan du publicerar.");
  }
  const updated = await publishBrfReview(propertyId, figures, user.id);
  after(() =>
    notifyCustomersOfPublishedBrf(propertyId)
      .then((sent) => console.info(`BRF review published for property ${propertyId}; ${sent} customer(s) notified.`))
      .catch((err) => console.error(`BRF review publish notification failed for property ${propertyId}:`, err))
  );
  return NextResponse.json({ review: updated });
}
