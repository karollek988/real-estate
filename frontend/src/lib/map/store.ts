import { createAdminClient } from "@/lib/supabase/admin";
import type { ListingInput, MapListingRow } from "./listings";
import type { MapTransport } from "./types";

/**
 * The map_listings table (supabase/migrations/20261010020104_map_listings.sql). Server only: the table has no
 * policy for the public, so everything goes through here with the service role, after the route has checked who
 * is asking.
 */

const TABLE = "map_listings";

/** A pending lookup older than this is taken to be abandoned (a function that was cut off) and is tried again. */
const PENDING_STALE_MS = 2 * 60_000;
/** A lookup that could not reach the source waits this long before the next try. */
const UNAVAILABLE_RETRY_MS = 5 * 60_000;

function client() {
  return createAdminClient();
}

function fail(what: string, message: string): never {
  throw new Error(`map listings: ${what} failed: ${message}`);
}

/** Every pin the viewer may see: the published ones, and their own (hidden or not). */
export async function listForViewer(viewerId: string | null): Promise<MapListingRow[]> {
  let query = client().from(TABLE).select("*").order("created_at", { ascending: true }).limit(1000);
  query = viewerId ? query.or(`status.eq.published,owner_id.eq.${viewerId}`) : query.eq("status", "published");
  const { data, error } = await query;
  if (error) fail("list", error.message);
  return (data ?? []) as MapListingRow[];
}

/** Everything, for the team's page. */
export async function listAll(): Promise<MapListingRow[]> {
  const { data, error } = await client().from(TABLE).select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) fail("list all", error.message);
  return (data ?? []) as MapListingRow[];
}

export async function getById(id: string): Promise<MapListingRow | null> {
  const { data, error } = await client().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) fail("get", error.message);
  return (data as MapListingRow | null) ?? null;
}

export async function countByOwner(ownerId: string, since?: Date): Promise<number> {
  let query = client().from(TABLE).select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
  if (since) query = query.gte("created_at", since.toISOString());
  const { count, error } = await query;
  if (error) fail("count", error.message);
  return count ?? 0;
}

function columnsOf(input: ListingInput) {
  return {
    kind: input.kind,
    title: input.title,
    note: input.note,
    details: input.details,
    meta: input.meta,
    link: input.link,
    image: input.image,
    lat: input.lat,
    lng: input.lng,
    to_note: input.toNote,
    to_lat: input.toLat,
    to_lng: input.toLng,
  };
}

export async function insertListing(ownerId: string, input: ListingInput): Promise<MapListingRow> {
  const { data, error } = await client().from(TABLE).insert({ owner_id: ownerId, ...columnsOf(input) }).select("*").single();
  if (error) fail("insert", error.message);
  return data as MapListingRow;
}

/**
 * Replaces the content of a pin. The kind cannot change. A sale listing that moved needs a new lookup, so its
 * transport info is cleared when the place is different.
 */
export async function updateListing(existing: MapListingRow, input: ListingInput): Promise<MapListingRow> {
  const moved = existing.lat !== input.lat || existing.lng !== input.lng;
  const { kind: _kind, ...columns } = columnsOf(input);
  const patch = moved ? { ...columns, transport: null, transport_status: "none", transport_at: null } : columns;
  const { data, error } = await client().from(TABLE).update(patch).eq("id", existing.id).select("*").single();
  if (error) fail("update", error.message);
  return data as MapListingRow;
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await client().from(TABLE).delete().eq("id", id);
  if (error) fail("delete", error.message);
}

/** The team hides or shows a pin. A shown pin forgets why it was hidden. */
export async function setHidden(id: string, hidden: boolean, adminId: string, reason: string | null): Promise<MapListingRow | null> {
  const patch = hidden
    ? { status: "hidden", hidden_reason: reason, hidden_by: adminId, hidden_at: new Date().toISOString() }
    : { status: "published", hidden_reason: null, hidden_by: null, hidden_at: null };
  const { data, error } = await client().from(TABLE).update(patch).eq("id", id).select("*").maybeSingle();
  if (error) fail("hide", error.message);
  return (data as MapListingRow | null) ?? null;
}

/**
 * Takes the job of looking up a sale listing's transport info, if nobody has it and it is not done: at most one
 * request does the lookup, however many ask at once. Returns the row when this call got the job, otherwise null.
 */
export async function claimTransport(id: string, now = new Date()): Promise<MapListingRow | null> {
  const staleBefore = new Date(now.getTime() - PENDING_STALE_MS).toISOString();
  const retryBefore = new Date(now.getTime() - UNAVAILABLE_RETRY_MS).toISOString();
  const { data, error } = await client()
    .from(TABLE)
    .update({ transport_status: "pending", transport_at: now.toISOString() })
    .eq("id", id)
    .eq("kind", "sale")
    .or(
      `transport_status.eq.none,and(transport_status.eq.unavailable,transport_at.lt.${retryBefore}),and(transport_status.eq.pending,transport_at.lt.${staleBefore})`
    )
    .select("*");
  if (error) fail("claim transport", error.message);
  return ((data ?? []) as MapListingRow[])[0] ?? null;
}

export async function saveTransport(id: string, transport: MapTransport): Promise<MapListingRow> {
  const { data, error } = await client()
    .from(TABLE)
    .update({ transport, transport_status: "ready", transport_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) fail("save transport", error.message);
  return data as MapListingRow;
}

export async function markTransportUnavailable(id: string): Promise<MapListingRow | null> {
  const { data, error } = await client()
    .from(TABLE)
    .update({ transport_status: "unavailable", transport_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) fail("mark transport unavailable", error.message);
  return (data as MapListingRow | null) ?? null;
}
