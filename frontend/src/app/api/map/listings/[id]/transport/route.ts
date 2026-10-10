import { NextResponse } from "next/server";
import { apiError } from "@/i18n/apiText";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { toDto } from "@/lib/map/listings";
import { mapImageUrl } from "@/lib/map/images";
import { getById } from "@/lib/map/store";
import { ensureTransport } from "@/lib/map/transportJob";
import { isListingId, viewerId } from "@/lib/map/viewer";

export const runtime = "nodejs";
// One lookup is two calls to Transitous, 8 s each at most.
export const maxDuration = 30;

/**
 * POST /api/map/listings/:id/transport - the pin as it is now, after making sure its transport info is looked up.
 * The map calls it when it opens a sale listing that has none yet (the built-in examples, a listing whose first
 * lookup failed, one that moved) and again a few seconds later while the lookup is running. Anyone who can see the
 * pin may ask; the lookup is done once however many ask (claimTransport), and an unreachable source is not asked
 * again for five minutes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!checkRateLimit(`map-transport:${clientIp(request)}`, 60, 60_000)) {
    return apiError(429, "rate_limited", "map.rateLimited", undefined, { request });
  }
  if (!isListingId(id)) return apiError(404, "not_found", "map.notFound", undefined, { request });

  try {
    const viewer = await viewerId();
    const row = await getById(id);
    // a pin the team hid is only for its owner
    if (!row || row.kind !== "sale" || (row.status === "hidden" && row.owner_id !== viewer)) {
      return apiError(404, "not_found", "map.notFound", undefined, { request });
    }
    const current = row.transport_status === "ready" ? row : ((await ensureTransport(id)) ?? row);
    return NextResponse.json({ listing: toDto(current, viewer, mapImageUrl) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error(`POST /api/map/listings/${id}/transport failed:`, err);
    return apiError(500, "internal_error", "map.loadFailed", undefined, { request });
  }
}
