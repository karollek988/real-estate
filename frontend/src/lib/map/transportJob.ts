import { claimTransport, getById, markTransportUnavailable, saveTransport } from "./store";
import { generateTransport } from "./transport";
import type { MapListingRow } from "./listings";

/**
 * Looks up and stores the transport info of one sale listing (lib/map/transport.ts). Called right after a listing is
 * saved, and again when someone opens a listing that has none (the built-in examples, a listing whose first lookup
 * failed, one that moved). Only one call at a time does the lookup (claimTransport); the others get the row as it is.
 * Never throws: a lookup that fails leaves the listing marked "unavailable" and is tried again later.
 */
export async function ensureTransport(id: string): Promise<MapListingRow | null> {
  try {
    const claimed = await claimTransport(id);
    if (!claimed) return await getById(id);
    try {
      return await saveTransport(id, await generateTransport(claimed.lat, claimed.lng));
    } catch (err) {
      console.error(`map listing ${id}: transport lookup failed:`, err);
      return await markTransportUnavailable(id);
    }
  } catch (err) {
    console.error(`map listing ${id}: could not start the transport lookup:`, err);
    return null;
  }
}
