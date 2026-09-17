/**
 * Shared secret sent on every server-to-server call to the Python analysis
 * engine (api/server.py) — verified there by its require_internal_secret
 * middleware. api/server.py has no auth of its own beyond this header, so
 * every call site that reaches PYTHON_ENGINE_API_URL must use this helper
 * for its headers rather than a bare `{ "Content-Type": "application/json" }`.
 *
 * PYTHON_ENGINE_API_SECRET is a server-only env var (never NEXT_PUBLIC_) —
 * it must never be read from, or forwarded to, browser/client code. If it
 * isn't configured, the header is simply omitted rather than throwing: the
 * Python engine then rejects the request with 401, which every existing
 * caller already handles the same way it handles any other backend error
 * (degrading to that provider's "error"/"not_connected" status, never
 * crashing the analysis pipeline).
 */
export function pythonEngineHeaders(extra?: Record<string, string>): Record<string, string> {
  // Same guard createAdminClient() (lib/supabase/admin.ts) uses for the
  // service-role key — this function must never run in a browser context,
  // since that would mean the secret got bundled into client code.
  if (typeof window !== "undefined") {
    throw new Error("pythonEngineHeaders must only be called on the server");
  }

  const secret = process.env.PYTHON_ENGINE_API_SECRET;
  return {
    "Content-Type": "application/json",
    ...(secret ? { "X-Internal-Secret": secret } : {}),
    ...extra,
  };
}
