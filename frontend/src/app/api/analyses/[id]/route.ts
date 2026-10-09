import { NextResponse } from "next/server";
import { getReportForViewer } from "@/lib/analysis/access";
import { requireUser } from "@/lib/auth/requireUser";
import { isAdminUser } from "@/lib/auth/admin";
import { apiError } from "@/i18n/apiText";

/**
 * GET /api/analyses/:id — one analysis (any version) with its property,
 * scoped to what the caller bought. A caller who bought nothing for the
 * analysis's property gets the same 404 as for an id that doesn't exist.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { user, response: authError } = await requireUser();
  if (authError) return authError;

  try {
    const found = await getReportForViewer(id, user.id, { isReviewer: isAdminUser(user) });
    if (!found) {
      return await apiError(404, "not_found", "analyses.notFound");
    }

    // error/failureReason are for internal review only (see report/page.tsx's
    // failed-analysis branch and the 2026-09 failed-analysis UX writeup) —
    // never forward the raw technical detail to the browser.
    const { error: _error, failureReason: _failureReason, ...analysisForClient } = found.analysis;

    return NextResponse.json({
      analysis: analysisForClient,
      property: found.property,
      analysisType: found.access.viewScope,
      // true while a reviewer has not released the full report: the analysis then carries no report
      held: found.access.held,
    });
  } catch (err) {
    console.error(`GET /api/analyses/${id} failed:`, err);
    return await apiError(500, "internal_error", "analyses.loadFailed");
  }
}
