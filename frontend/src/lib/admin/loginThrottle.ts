/**
 * Per-client lockout for the admin login: after MAX_FAILURES failed attempts
 * within WINDOW_MS the client is refused until the oldest failure ages out.
 * Only failures count (a successful login clears the client's record), and
 * checking happens BEFORE any password hashing, so a locked-out client cannot
 * burn CPU/memory on scrypt.
 *
 * Like lib/rateLimit.ts this is in-memory and per server instance - it slows
 * guessing and bounds cost, it is not a distributed guarantee. A Vercel
 * Firewall rate-limit rule on POST /api/admin-portal/login is the shared layer.
 */
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;
// Same unbounded-growth guard as lib/rateLimit.ts.
const MAX_TRACKED_CLIENTS = 10_000;

const failuresByClient = new Map<string, number[]>();

function recentFailures(clientKey: string, now: number): number[] {
  const recent = (failuresByClient.get(clientKey) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length) failuresByClient.set(clientKey, recent);
  else failuresByClient.delete(clientKey);
  return recent;
}

export type LoginThrottleState = { locked: false } | { locked: true; retryAfterSeconds: number };

export function checkLoginThrottle(clientKey: string, now: number = Date.now()): LoginThrottleState {
  const recent = recentFailures(clientKey, now);
  if (recent.length < MAX_FAILURES) return { locked: false };
  return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000)) };
}

export function recordLoginFailure(clientKey: string, now: number = Date.now()): void {
  if (failuresByClient.size > MAX_TRACKED_CLIENTS) failuresByClient.clear();
  failuresByClient.set(clientKey, [...recentFailures(clientKey, now), now]);
}

export function clearLoginFailures(clientKey: string): void {
  failuresByClient.delete(clientKey);
}
