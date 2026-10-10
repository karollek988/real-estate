import { after, NextResponse } from "next/server";
import { apiError } from "@/i18n/apiText";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit } from "@/lib/rateLimit";
import { toDto, validateListing } from "@/lib/map/listings";
import { mapImageUrl, removeMapImage } from "@/lib/map/images";
import { deleteListing, getById, updateListing } from "@/lib/map/store";
import { ensureTransport } from "@/lib/map/transportJob";
import { isListingId } from "@/lib/map/viewer";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * PATCH  /api/map/listings/:id - the owner replaces what they wrote (the kind stays). Moving a sale listing gets
 *                                its transport info looked up again.
 * DELETE /api/map/listings/:id - the owner removes it, and its picture.
 * Only the owner: the built-in examples have none, so nobody can change them here (the team hides them in /admin/map).
 */
async function ownedBy(request: Request, id: string, userId: string) {
  if (!isListingId(id)) return { error: await apiError(404, "not_found", "map.notFound", undefined, { request }) };
  const row = await getById(id);
  if (!row) return { error: await apiError(404, "not_found", "map.notFound", undefined, { request }) };
  if (row.owner_id !== userId) return { error: await apiError(403, "not_yours", "map.notYours", undefined, { request }) };
  return { row };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requireUser();
  if (response) return response;
  if (!checkRateLimit(`map-edit:${user.id}`, 60, 60 * 60_000)) {
    return apiError(429, "rate_limited", "map.rateLimited", undefined, { request });
  }

  try {
    const owned = await ownedBy(request, id, user.id);
    if ("error" in owned) return owned.error;

    const body = await request.json().catch(() => null);
    const check = validateListing(body && typeof body === "object" ? { ...body, kind: owned.row.kind } : body, user.id);
    if (!check.ok) {
      const res = await apiError(422, "invalid_listing", "map.invalid", undefined, { request });
      const json = await res.json();
      return NextResponse.json({ error: { ...json.error, field: check.field } }, { status: 422 });
    }

    const row = await updateListing(owned.row, check.value);
    if (row.image !== owned.row.image) after(() => removeMapImage(owned.row.image));
    if (row.kind === "sale" && row.transport_status === "none") after(() => ensureTransport(row.id));
    const listing = toDto(row, user.id, mapImageUrl);
    return NextResponse.json({ listing: row.kind === "sale" && row.transport_status === "none" ? { ...listing, transportStatus: "pending" } : listing });
  } catch (err) {
    console.error(`PATCH /api/map/listings/${id} failed:`, err);
    return apiError(500, "internal_error", "map.saveFailed", undefined, { request });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, response } = await requireUser();
  if (response) return response;
  if (!checkRateLimit(`map-edit:${user.id}`, 60, 60 * 60_000)) {
    return apiError(429, "rate_limited", "map.rateLimited", undefined, { request });
  }

  try {
    const owned = await ownedBy(request, id, user.id);
    if ("error" in owned) return owned.error;
    await deleteListing(id);
    after(() => removeMapImage(owned.row.image));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /api/map/listings/${id} failed:`, err);
    return apiError(500, "internal_error", "map.saveFailed", undefined, { request });
  }
}
