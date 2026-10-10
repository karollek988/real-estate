import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { cleanText } from "@/lib/map/listings";
import { setHidden } from "@/lib/map/store";
import { isListingId } from "@/lib/map/viewer";

export const runtime = "nodejs";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * POST /api/admin/map-listings/:id - the team hides or shows a pin on the public map (reviewers only,
 * lib/auth/admin.ts). Body: { action: "hide" | "show", reason?: string }. A hidden pin disappears for everyone but its
 * owner, who still sees it marked as hidden. Nothing is deleted.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requireAdmin();
  if (response) return response;
  if (!isListingId(id)) return errorResponse(404, "not_found", "Annonsen finns inte.");

  const body = (await request.json().catch(() => null)) as { action?: unknown; reason?: unknown } | null;
  if (body?.action !== "hide" && body?.action !== "show") {
    return errorResponse(400, "invalid_request", 'action must be "hide" or "show".');
  }
  const reason = body.reason == null || body.reason === "" ? null : cleanText(body.reason, 300);
  if (body.reason != null && body.reason !== "" && reason === null) {
    return errorResponse(422, "invalid_reason", "Anledningen är för lång (högst 300 tecken).");
  }

  try {
    const row = await setHidden(id, body.action === "hide", user.id, reason);
    if (!row) return errorResponse(404, "not_found", "Annonsen finns inte.");
    return NextResponse.json({ id: row.id, status: row.status });
  } catch (err) {
    console.error(`POST /api/admin/map-listings/${id} failed:`, err);
    return errorResponse(500, "internal_error", "Något gick fel. Försök igen.");
  }
}
