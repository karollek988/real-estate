import type { MapKind, MapListingDto, MapTransport, TransportStatus } from "./types";

/**
 * The rules of a listing on the public map and how a stored row becomes what the map is shown. Pure, so
 * listings.verify.mjs checks it without a database. The API routes (app/api/map) apply it; the table repeats the
 * hard limits as checks (supabase/migrations/20261010020104_map_listings.sql).
 */

/** How many pins one account may post: per day, and in all. */
export const LISTING_LIMITS = { perDay: 10, total: 30 } as const;

/** The longest each text may be. More generous than the form's own limits, which the browser applies first. */
export const TEXT_LIMITS = { title: 100, note: 160, meta: 160, details: 600, link: 500 } as const;

/** Sweden with some margin: the map only takes places here (the table checks the same box). */
export const SWEDEN_BOX = { latMin: 54.5, latMax: 69.5, lngMin: 10, lngMax: 25 } as const;

export type ListingField = "kind" | "title" | "note" | "details" | "meta" | "link" | "place" | "toPlace" | "image";

export interface ListingInput {
  kind: MapKind;
  title: string;
  note: string;
  details: string | null;
  meta: string | null;
  link: string | null;
  /** A path in the pictures bucket ("<owner id>/<name>.webp") that this owner uploaded, or null. */
  image: string | null;
  lat: number;
  lng: number;
  toNote: string | null;
  toLat: number | null;
  toLng: number | null;
}

export type ListingCheck = { ok: true; value: ListingInput } | { ok: false; field: ListingField };

const KINDS: readonly MapKind[] = ["sale", "buyer", "exchange"];
const IMAGE_PATH = /^([0-9a-f-]{36})\/[A-Za-z0-9_-]+\.webp$/;

/** Text from a visitor: control characters out (new lines stay), edges trimmed. null when it is not text. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return text.length <= max ? text : null;
}

/** An http(s) address without a login in it, or null. */
export function cleanLink(value: unknown): string | null {
  const text = cleanText(value, TEXT_LIMITS.link);
  if (!text) return null;
  try {
    const url = new URL(text);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname || url.username || url.password) return null;
    return text;
  } catch {
    return null;
  }
}

export function inSweden(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= SWEDEN_BOX.latMin && lat <= SWEDEN_BOX.latMax && lng >= SWEDEN_BOX.lngMin && lng <= SWEDEN_BOX.lngMax
  );
}

/**
 * Checks what a signed-in user sends to create (or replace the content of) a pin. `ownerId` is who is sending: a
 * picture must be one that this person uploaded.
 */
export function validateListing(body: unknown, ownerId: string): ListingCheck {
  if (!body || typeof body !== "object") return { ok: false, field: "kind" };
  const b = body as Record<string, unknown>;
  const kind = b.kind;
  if (typeof kind !== "string" || !KINDS.includes(kind as MapKind)) return { ok: false, field: "kind" };

  const title = cleanText(b.title, TEXT_LIMITS.title);
  if (!title) return { ok: false, field: "title" };
  const note = cleanText(b.note, TEXT_LIMITS.note);
  if (!note) return { ok: false, field: "note" };
  const details = b.details == null || b.details === "" ? null : cleanText(b.details, TEXT_LIMITS.details);
  if (b.details != null && b.details !== "" && details === null) return { ok: false, field: "details" };
  const meta = b.meta == null || b.meta === "" ? null : cleanText(b.meta, TEXT_LIMITS.meta);
  if (b.meta != null && b.meta !== "" && meta === null) return { ok: false, field: "meta" };

  let link: string | null = null;
  if (kind === "sale" && b.link != null && b.link !== "") {
    link = cleanLink(b.link);
    if (!link) return { ok: false, field: "link" };
  }

  let image: string | null = null;
  if (b.image != null && b.image !== "") {
    const match = typeof b.image === "string" ? IMAGE_PATH.exec(b.image) : null;
    if (!match || match[1] !== ownerId) return { ok: false, field: "image" };
    image = b.image as string;
  }

  if (!inSweden(b.lat, b.lng)) return { ok: false, field: "place" };

  let toNote: string | null = null;
  let toLat: number | null = null;
  let toLng: number | null = null;
  if (kind === "exchange") {
    toNote = cleanText(b.toNote, TEXT_LIMITS.note);
    if (!toNote) return { ok: false, field: "toPlace" };
    if (!inSweden(b.toLat, b.toLng)) return { ok: false, field: "toPlace" };
    toLat = b.toLat as number;
    toLng = b.toLng as number;
  }

  return {
    ok: true,
    value: { kind: kind as MapKind, title, note, details, meta, link, image, lat: b.lat as number, lng: b.lng as number, toNote, toLat, toLng },
  };
}

/** A row of the table, as it is stored. */
export interface MapListingRow {
  id: string;
  kind: MapKind;
  owner_id: string | null;
  example_key: string | null;
  title: string;
  note: string;
  details: string | null;
  meta: string | null;
  link: string | null;
  image: string | null;
  lat: number;
  lng: number;
  to_note: string | null;
  to_lat: number | null;
  to_lng: number | null;
  status: "published" | "hidden";
  hidden_reason: string | null;
  hidden_by: string | null;
  hidden_at: string | null;
  transport: MapTransport | null;
  transport_status: TransportStatus;
  transport_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The pin as the map gets it: no owner, a picture as a full address, "mine" worked out for this viewer. */
export function toDto(row: MapListingRow, viewerId: string | null, imageUrl: (value: string | null) => string | null): MapListingDto {
  return {
    id: row.id,
    kind: row.kind,
    exampleKey: row.example_key,
    title: row.title,
    note: row.note,
    details: row.details,
    meta: row.meta,
    link: row.link,
    image: imageUrl(row.image),
    lat: row.lat,
    lng: row.lng,
    toNote: row.to_note,
    toLat: row.to_lat,
    toLng: row.to_lng,
    hidden: row.status === "hidden",
    isMine: viewerId !== null && row.owner_id === viewerId,
    transport: row.kind === "sale" ? row.transport : null,
    transportStatus: row.kind === "sale" ? row.transport_status : "none",
  };
}
