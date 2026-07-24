/** Parse a Swedish-formatted number string (e.g., "3 450 000 kr" or "1 234,50"). */
export function parseSekNumber(str: string): number | null {
  const cleaned = str.replace(/[^\d.,]/g, "").replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Strip HTML tags from a string. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#\d+;/g, "");
}

/** Dedupe strings while preserving first-seen order (used for merged image/feature lists). */
export function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v && v.trim().length > 0)));
}

/**
 * Read a value out of Hemnet's Apollo cache entry for a GraphQL field that
 * was queried with arguments — the cache key embeds the args as JSON, e.g.
 * `images({"limit":300})` or `url({"format":"ITEMGALLERY_CUT"})`, and the
 * exact argument value isn't predictable from outside the query. Returns the
 * first key that starts with `prefix(`, or the exact `prefix` key if the
 * field takes no arguments.
 */
export function readParamField(obj: Record<string, unknown>, prefix: string): unknown {
  if (prefix in obj) return obj[prefix];
  const key = Object.keys(obj).find((k) => k.startsWith(`${prefix}(`));
  return key ? obj[key] : undefined;
}

/** Resolve an Apollo normalized-cache `{ __ref: "Type:id" }` pointer to its entity, if any. */
export function resolveRef(
  apolloState: Record<string, unknown>,
  value: unknown
): Record<string, unknown> | null {
  if (value && typeof value === "object" && "__ref" in (value as Record<string, unknown>)) {
    const ref = (value as { __ref: unknown }).__ref;
    if (typeof ref !== "string") return null;
    const resolved = apolloState[ref];
    return resolved && typeof resolved === "object" ? (resolved as Record<string, unknown>) : null;
  }
  return null;
}

/** Read `.amount` off an Apollo `Money` value (`{ __typename: "Money", amount, ... }`). */
export function moneyAmount(value: unknown): number | null {
  if (value && typeof value === "object" && typeof (value as Record<string, unknown>).amount === "number") {
    return (value as Record<string, unknown>).amount as number;
  }
  return null;
}

/** Parse the leading number out of a formatted "1 234 m²"/"1 234,5 m²" string. */
export function parseAreaString(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
