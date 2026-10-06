import { createHmac, hkdfSync, randomBytes } from "node:crypto";

/**
 * The anonymous, daily value that lets a visitor be counted once per day without
 * being recognised - see supabase/migrations/20261006000000_site_analytics.sql.
 *
 *   visitor = HMAC-SHA256(key, day | IP address | user agent)
 *
 * The key is a server secret and the day is part of the input, so the value can't
 * be turned back into an IP address and is different every day. The IP address
 * and user agent exist in memory for the length of one request and are stored
 * nowhere.
 */

const MIN_SECRET_LENGTH = 32;

let cachedKey: Buffer | null = null;

function derive(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "kopanalys-analytics", "visitor-hash-v1", 32));
}

/**
 * ANALYTICS_HASH_SECRET if set (at least 32 characters), else derived from the
 * service role key, which the server already holds. With neither (local
 * development without Supabase) a random key lives for this process only:
 * visitors then count as new after a restart, which is harmless there.
 */
export function getVisitorKey(): Buffer {
  if (cachedKey) return cachedKey;
  const explicit = process.env.ANALYTICS_HASH_SECRET?.trim();
  const shared = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (explicit && explicit.length >= MIN_SECRET_LENGTH) cachedKey = derive(explicit);
  else if (shared) cachedKey = derive(shared);
  else cachedKey = randomBytes(32);
  return cachedKey;
}

/** 32 hex characters (128 bits): collisions are no concern at this size of audience. */
export function visitorHash(key: Buffer, day: string, ip: string, userAgent: string): string {
  return createHmac("sha256", key).update(`${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}
