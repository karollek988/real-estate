/**
 * Address normalization for property deduplication.
 *
 * A property must exist only once in the database. The normalized key is the
 * dedupe identity: folded address + municipality + apartment number. Known
 * limitation (documented in docs/25_analysis_pipeline.md): the same physical
 * property entered with differently written addresses (e.g. with vs without
 * the city in the address field) can produce different keys — Hemnet URLs are
 * additionally matched on the URL itself to compensate.
 */

/** Lowercase, strip diacritics (å→a, ö→o), drop punctuation, collapse spaces. */
export function foldForKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizedPropertyKey(parts: {
  address: string;
  municipality?: string | null;
  apartmentNumber?: string | null;
}): string {
  return [
    foldForKey(parts.address),
    parts.municipality ? foldForKey(parts.municipality) : "",
    parts.apartmentNumber ? foldForKey(parts.apartmentNumber) : "",
  ].join("|");
}
