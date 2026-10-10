/**
 * What the public map (/karta) and its API (app/api/map) pass between them. The map's own code
 * (components/admin/atlas/atlas.ts) imports the types only.
 */

export type MapKind = "sale" | "buyer" | "exchange";

/** none: not tried yet. pending: being fetched. ready. unavailable: the source could not be reached; tried again later. */
export type TransportStatus = "none" | "pending" | "ready" | "unavailable";

export interface MapTransportStop {
  name: string;
  /** Straight-line distance from the listing, rounded to 10 m. */
  distanceM: number;
}

/**
 * The lite area analysis of a sale listing: only how to get around, only facts. A stop that is null is not within
 * `searchedWithinM` metres - that is stated as missing, never guessed.
 */
export interface MapTransport {
  bus: MapTransportStop | null;
  train: MapTransportStop | null;
  searchedWithinM: number;
  source: "transitous";
  fetchedAt: string;
}

/** A pin as the map gets it. Never carries who posted it. */
export interface MapListingDto {
  id: string;
  kind: MapKind;
  /** 'sale-1', 'buyer-101'...: the built-in examples, whose words come from the message files. */
  exampleKey: string | null;
  title: string;
  note: string;
  details: string | null;
  meta: string | null;
  link: string | null;
  /** A full address, or null. */
  image: string | null;
  lat: number;
  lng: number;
  toNote: string | null;
  toLat: number | null;
  toLng: number | null;
  /** Hidden by the team: only its owner gets it, marked as such. */
  hidden: boolean;
  isMine: boolean;
  transport: MapTransport | null;
  transportStatus: TransportStatus;
}
