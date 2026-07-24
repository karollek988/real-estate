/** Shared JSON-fetch helper for providers — consistent timeout/error shape. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10000
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `${url} responded ${res.status}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Shared, shape-agnostic field readers for arbitrary provider JSON payloads. */
export function getNested(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function numberField(obj: Record<string, unknown>, path: string[]): number | undefined {
  const value = getNested(obj, path);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function stringField(obj: Record<string, unknown>, path: string[]): string | undefined {
  const value = getNested(obj, path);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** Booleans are sometimes typed int (0/1) or stringly-typed across these APIs. */
export function booleanField(obj: Record<string, unknown>, path: string[]): boolean | undefined {
  const value = getNested(obj, path);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : undefined;
  if (typeof value === "string") {
    if (value === "1" || value.toLowerCase() === "true") return true;
    if (value === "0" || value.toLowerCase() === "false") return false;
  }
  return undefined;
}

/** Haversine distance in meters between two lat/lon points. */
export function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
