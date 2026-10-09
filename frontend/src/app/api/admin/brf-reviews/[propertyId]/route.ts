import { after, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { hasAnyBrfFigure, parseBrfFigures } from "@/lib/brf/figures";
import { getBrfReview, markBrfReviewNotApplicable, publishBrfReview, saveBrfReviewDraft } from "@/lib/brf/reviews";
import { notifyCustomersOfPublishedBrf } from "@/lib/brf/notify";
import { latestPendingAnalysis, releaseWaitingAnalyses } from "@/lib/analysis/store";

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
 *                    analysis, release the finished report(s) of the home that
 *                    wait for a reviewer, and email the customers
 *  - not_applicable: the home has no housing association (or is freehold);
 *                    the waiting report(s) are released the same way
 *
 * A report reaches its customer only through here (lib/analysis/release.ts), so
 * publishing is refused while the analysis is still being made: the reviewer
 * must have a finished report to read.
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
    if (await latestPendingAnalysis(propertyId)) return reportNotReady();
    const updated = await markBrfReviewNotApplicable(propertyId, user.id);
    const released = await releaseWaitingAnalyses(propertyId, user.id);
    if (released.length > 0) notifyAfterRelease(propertyId);
    return NextResponse.json({ review: updated, released: released.length });
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
  if (await latestPendingAnalysis(propertyId)) return reportNotReady();
  const updated = await publishBrfReview(propertyId, figures, user.id);
  const released = await releaseWaitingAnalyses(propertyId, user.id);
  notifyAfterRelease(propertyId);
  return NextResponse.json({ review: updated, released: released.length });
}

function reportNotReady() {
  return errorResponse(
    409,
    "analysis_not_ready",
    "Rapporten håller fortfarande på att tas fram. Vänta tills den är klar, läs den och publicera sedan."
  );
}

/** The customers hear that their report is ready; a failed e-mail never fails the publish. */
function notifyAfterRelease(propertyId: string) {
  after(() =>
    notifyCustomersOfPublishedBrf(propertyId)
      .then((sent) => console.info(`Review published for property ${propertyId}; ${sent} customer(s) notified.`))
      .catch((err) => console.error(`Review publish notification failed for property ${propertyId}:`, err))
  );
}
