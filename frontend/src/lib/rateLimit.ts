/**
 * Minimal in-memory per-IP rate limiter for public, unauthenticated routes
 * (chat, contact) that call a paid external API with no other cost control.
 *
 * This is intentionally not a distributed limiter — each warm serverless
 * instance keeps its own counters, so under horizontal scaling the *real*
 * effective limit across all instances is looser than the configured one.
 * That's an accepted trade-off to add real cost protection today with zero
 * new infrastructure (no Redis/Upstash) - see the production-readiness
 * report (2026-09) for when to upgrade to a shared store (e.g. Vercel KV /
 * Upstash) instead.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Unbounded growth guard: if this ever gets absurdly large (a distributed
// attack from many IPs), drop the whole map rather than leak memory forever
// - a full reset under attack is an acceptable cost for a free-tier limiter.
const MAX_TRACKED_KEYS = 50_000;

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();

  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Best-effort client IP from the headers Vercel's edge sets. Never trust
 *  this for anything beyond rate-limiting - it's attacker-influenceable. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
