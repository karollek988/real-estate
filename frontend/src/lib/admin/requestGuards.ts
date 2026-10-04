/** Shared request checks for the admin portal's API routes. */

const MAX_BODY_BYTES = 4 * 1024;

/**
 * State-changing admin requests must come from a page on the admin origin
 * itself. Browsers always send Origin on a cross-site or same-origin POST, and
 * Sec-Fetch-Site (when present) can't be forged by page script.
 */
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type JsonBodyResult = { ok: true; value: unknown } | { ok: false; reason: "too_large" | "invalid_json" | "unsupported_media_type" };

export async function readSmallJsonBody(request: Request): Promise<JsonBodyResult> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { ok: false, reason: "unsupported_media_type" };
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return { ok: false, reason: "too_large" };

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, reason: "too_large" };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

export function adminJson(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extraHeaders },
  });
}
