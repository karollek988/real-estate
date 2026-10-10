import { after, NextResponse } from "next/server";
import { apiError } from "@/i18n/apiText";
import { requireUser } from "@/lib/auth/requireUser";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { LISTING_LIMITS, toDto, validateListing } from "@/lib/map/listings";
import { mapImageUrl } from "@/lib/map/images";
import { countByOwner, insertListing, listForViewer } from "@/lib/map/store";
import { ensureTransport } from "@/lib/map/transportJob";
import { viewerId } from "@/lib/map/viewer";

export const runtime = "nodejs";
// A new sale listing's transport lookup runs after the answer has gone out (two calls to Transitous, 8 s each at most).
export const maxDuration = 30;

/**
 * GET  /api/map/listings - the public map's pins: everything published, and the viewer's own (hidden or not).
 *                          Anyone may look; the answer never says who posted a pin.
 * POST /api/map/listings - a signed-in user posts a pin (sale, buyer wish or exchange). A sale listing gets its
 *                          transport info looked up right away (lib/map/transportJob.ts).
 */
export async function GET(request: Request) {
  if (!checkRateLimit(`map-list:${clientIp(request)}`, 120, 60_000)) {
    return apiError(429, "rate_limited", "map.rateLimited", undefined, { request });
  }
  try {
    const viewer = await viewerId();
    const rows = await listForViewer(viewer);
    return NextResponse.json(
      { listings: rows.map((row) => toDto(row, viewer, mapImageUrl)) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    console.error("GET /api/map/listings failed:", err);
    return apiError(500, "internal_error", "map.loadFailed", undefined, { request });
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;

  if (!checkRateLimit(`map-post:${user.id}`, 20, 60 * 60_000)) {
    return apiError(429, "rate_limited", "map.rateLimited", undefined, { request });
  }

  const body = await request.json().catch(() => null);
  const check = validateListing(body, user.id);
  if (!check.ok) {
    const res = await apiError(422, "invalid_listing", "map.invalid", undefined, { request });
    const json = await res.json();
    return NextResponse.json({ error: { ...json.error, field: check.field } }, { status: 422 });
  }

  try {
    if ((await countByOwner(user.id)) >= LISTING_LIMITS.total) {
      return apiError(409, "limit_reached", "map.totalLimit", { count: LISTING_LIMITS.total }, { request });
    }
    if ((await countByOwner(user.id, new Date(Date.now() - 24 * 60 * 60_000))) >= LISTING_LIMITS.perDay) {
      return apiError(429, "daily_limit", "map.dailyLimit", { count: LISTING_LIMITS.perDay }, { request });
    }

    const row = await insertListing(user.id, check.value);
    if (row.kind === "sale") after(() => ensureTransport(row.id));
    const listing = toDto(row, user.id, mapImageUrl);
    return NextResponse.json({ listing: row.kind === "sale" ? { ...listing, transportStatus: "pending" } : listing }, { status: 201 });
  } catch (err) {
    console.error("POST /api/map/listings failed:", err);
    return apiError(500, "internal_error", "map.saveFailed", undefined, { request });
  }
}
