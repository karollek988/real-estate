import { createHash, randomBytes } from "node:crypto";
import type { DataProvider, ProviderResult } from "./types";
import { getNested, numberField, stringField, booleanField } from "./httpJson.ts";
import { summarizeSold, type RawSoldEntry } from "./soldSummary.ts";

/**
 * Real provider: Booli Listing API v2 (docs/data-source-inventory.md entry 1
 * — API key issued on request at api@booli.se; free tier restricts
 * competitive/commercial use, verify current contract terms before a
 * commercial launch).
 *
 * Complements Hemnet (listing/hemnetPage.ts) rather than duplicating it:
 * Hemnet fetches the listing's own URL (perfect identity match) and is the
 * ground truth for the live listing's own facts. Booli's unique value is
 * data Hemnet cannot give — the property's own past sale (`/sold`, exact
 * address) and nearby comparable sold prices (`/sold`, area query) that
 * `area_median_price_per_m2_sek` (engine/analyzers/price.ts) has been
 * waiting on since it was written. Where the same fact exists on both
 * sources, Hemnet wins (see identityTrust.ts) — Booli only fills a gap or
 * is discarded as a conflict, never silently overwrites.
 *
 * CALIBRATION STATUS (2026-07-22): the previous version of this file was
 * never exercised against a live response and had two undetected bugs that
 * would have made every authenticated request fail:
 *   1. The signing hash omitted the required `unique` nonce.
 *   2. The `/listings` request never included a `unique` parameter at all.
 * Both are fixed below and cross-checked two ways without needing a live
 * key:
 *   - Live, unauthenticated probing of https://api.booli.se (curl, 2026-07-22)
 *     confirms the endpoint exists, confirms `/listings`, `/sold` and
 *     `/areas` all exist as separate resources, and confirms the exact
 *     required parameter set via the API's own error body: "FAILURE_MISSING_PARAM
 *     - Parameter missing. Request must contain callerId, unique, time and hash."
 *   - Three independent, pre-existing open-source Booli API v2 clients
 *     (rbooli, the `booli-api` npm package, and peterstark72/booli) agree
 *     byte-for-byte on the hash formula (sha1(callerId + time + apiKey +
 *     unique)) and on the `Property` JSON schema used by both `/listings`
 *     and `/sold` (field names/types below are taken from that struct).
 * What remains unverified: an actual authenticated 200 response body — no
 * BOOLI_CALLER_ID/BOOLI_API_KEY is available in this environment. Without
 * them, this provider correctly reports "not_connected", never fake data.
 *
 * Fields present in the confirmed schema that the previous version guessed
 * wrong or invented were removed rather than left in as dead code:
 * `energyClass`/`housingCooperative`/`operatingCost`/`description`/`images`
 * have no equivalent on the real `Property` object — Hemnet remains the
 * only source for all of those.
 */

const BOOLI_BASE = "https://api.booli.se";
const REQUEST_TIMEOUT_MS = 8000;
const SOLD_COMPARABLES_LIMIT = 20;
const MAX_COMPARABLES_RETURNED = 15;

export interface BooliProperty {
  [key: string]: unknown;
}

interface BooliApiResponse {
  listings?: BooliProperty[];
  sold?: BooliProperty[];
}

function randomUnique(): string {
  return randomBytes(8).toString("hex");
}

/** hash = sha1(callerId + time + apiKey + unique) — see CALIBRATION STATUS above. */
function sign(callerId: string, apiKey: string, unixTime: number, unique: string): string {
  return createHash("sha1").update(`${callerId}${unixTime}${apiKey}${unique}`).digest("hex");
}

function splitStreet(address: string): { street: string; number: string | null } {
  const cleaned = address.toLowerCase().split(",")[0].trim();
  const match = cleaned.match(/^(.*?)\s+(\d+\s*[a-z]?)$/);
  return match ? { street: match[1].trim(), number: match[2].replace(/\s+/g, "") } : { street: cleaned, number: null };
}

/**
 * Whether a Booli search result plausibly IS the property being analyzed.
 * `/listings` and `/sold` are free-text search (`q=...`), not an ID lookup —
 * Booli can return a different unit in the same building, or an unrelated
 * street, as its best match. This is the guard that keeps that mismatch
 * from ever reaching identity-sensitive attributes (mirrors
 * BRF-Scraper/booli_provider.py::_split_address, which solves the same
 * problem against Booli's website rather than this API).
 */
export function addressesMatch(targetAddress: string, candidateAddress: string | null | undefined): boolean {
  if (!candidateAddress) return false;
  const target = splitStreet(targetAddress);
  const candidate = splitStreet(candidateAddress);
  if (!target.street || !candidate.street) return false;
  const streetMatches =
    target.street === candidate.street ||
    target.street.startsWith(candidate.street) ||
    candidate.street.startsWith(target.street);
  if (!streetMatches) return false;
  if (target.number && candidate.number) return target.number === candidate.number;
  return true;
}

export interface ParsedBooliProperty {
  booliId?: number;
  url?: string;
  objectType?: string;
  streetAddress?: string;
  municipalityName?: string;
  countyName?: string;
  latitude?: number;
  longitude?: number;
  listPriceSek?: number;
  firstPriceSek?: number;
  soldPriceSek?: number;
  soldDate?: string;
  publishedDate?: string;
  rooms?: number;
  livingAreaM2?: number;
  plotAreaM2?: number;
  additionalAreaM2?: number;
  monthlyFeeSek?: number;
  floor?: number;
  buildingYear?: number;
  balcony?: boolean;
  patio?: boolean;
  elevator?: boolean;
  newConstruction?: boolean;
  solarPanels?: boolean;
  fireplace?: boolean;
  biddingOpen?: boolean;
  mortgageDeed?: boolean;
}

export function parseBooliProperty(listing: BooliProperty): ParsedBooliProperty {
  return {
    booliId: numberField(listing, ["booliId"]),
    url: stringField(listing, ["url"]),
    objectType: stringField(listing, ["objectType"]),
    streetAddress: stringField(listing, ["location", "address", "streetAddress"]),
    municipalityName: stringField(listing, ["location", "region", "municipalityName"]),
    countyName: stringField(listing, ["location", "region", "countyName"]),
    latitude: numberField(listing, ["location", "position", "latitude"]),
    longitude: numberField(listing, ["location", "position", "longitude"]),
    listPriceSek: numberField(listing, ["listPrice"]),
    firstPriceSek: numberField(listing, ["firstPrice"]),
    soldPriceSek: numberField(listing, ["soldPrice"]),
    soldDate: stringField(listing, ["soldDate"]),
    publishedDate: stringField(listing, ["published"]),
    rooms: numberField(listing, ["rooms"]),
    livingAreaM2: numberField(listing, ["livingArea"]),
    plotAreaM2: numberField(listing, ["plotArea"]),
    additionalAreaM2: numberField(listing, ["additionalArea"]),
    monthlyFeeSek: numberField(listing, ["rent"]),
    floor: numberField(listing, ["floor"]),
    buildingYear: numberField(listing, ["constructionYear"]),
    balcony: booleanField(listing, ["hasBalcony"]),
    patio: booleanField(listing, ["hasPatio"]),
    elevator: booleanField(listing, ["buildingHasElevator"]),
    newConstruction: booleanField(listing, ["isNewConstruction"]),
    solarPanels: booleanField(listing, ["hasSolarPanels"]),
    fireplace: booleanField(listing, ["hasFirePlace"]),
    biddingOpen: booleanField(listing, ["biddingOpen"]),
    mortgageDeed: booleanField(listing, ["mortageDeed"]), // Booli's own key, misspelled — not our typo
  };
}

export type { ComparableSale, SoldSummary } from "./soldSummary";

/**
 * Splits a `/sold` result set into the subject property's own sale history
 * (excluded from the comparables pool — it isn't a comparable to itself)
 * and nearby comparable sales, then derives the area median price/m² that
 * engine/analyzers/price.ts has had a dormant upgrade path for since it was
 * written (`area_median_price_per_m2_sek`). Delegates the shape-agnostic
 * algorithm to soldSummary.ts (shared with parseBotBooli.ts, whose /sold
 * equivalent is flat where Booli API v2's is nested).
 */
export function summarizeSoldListings(soldRaw: BooliProperty[], targetAddress: string) {
  const entries: RawSoldEntry[] = soldRaw
    .map(parseBooliProperty)
    .filter((p): p is ParsedBooliProperty & { soldPriceSek: number } => p.soldPriceSek !== undefined)
    .map((p) => ({
      streetAddress: p.streetAddress ?? null,
      soldPriceSek: p.soldPriceSek,
      soldDate: p.soldDate ?? null,
      livingAreaM2: p.livingAreaM2 ?? null,
      rooms: p.rooms ?? null,
    }));

  return summarizeSold(entries, targetAddress, addressesMatch, { maxComparablesReturned: MAX_COMPARABLES_RETURNED });
}

async function booliRequest(
  path: "listings" | "sold",
  callerId: string,
  apiKey: string,
  extraQuery: Record<string, string>
): Promise<{ items: BooliProperty[] } | { error: string }> {
  const unixTime = Math.floor(Date.now() / 1000);
  const unique = randomUnique();
  const params = new URLSearchParams({
    callerId,
    time: String(unixTime),
    unique,
    hash: sign(callerId, apiKey, unixTime, unique),
    ...extraQuery,
  });

  let res: Response;
  try {
    res = await fetch(`${BOOLI_BASE}/${path}?${params}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    return { error: `Booli ${path} request failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!res.ok) {
    // Booli's error responses are a plain-text code (e.g. "FAILURE_MISSING_PARAM
    // - ..." or "FAILURE_IDENTITY_NOT_FOUND - ...", verified live 2026-07-22) —
    // surface it; it's the only diagnostic available once real credentials exist.
    const bodyText = await res.text().catch(() => "");
    return { error: `Booli ${path} responded ${res.status}${bodyText ? `: ${bodyText}` : ""}` };
  }

  let body: BooliApiResponse;
  try {
    body = (await res.json()) as BooliApiResponse;
  } catch {
    return { error: `Booli ${path} response was not valid JSON` };
  }

  return { items: (path === "listings" ? body.listings : body.sold) ?? [] };
}

export const booliListingProvider: DataProvider = {
  id: "booli_listing",
  name: "Listing & sold-price data (Booli)",
  kind: "real",

  async collect({ extracted }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;
    const callerId = process.env.BOOLI_CALLER_ID;
    const apiKey = process.env.BOOLI_API_KEY;

    if (!callerId || !apiKey) {
      return {
        source: {
          ...base,
          status: "not_connected",
          fields: [],
          detail: "Booli API credentials not configured (set BOOLI_CALLER_ID and BOOLI_API_KEY).",
        },
        data: {},
      };
    }

    const listingQuery = [extracted.address, extracted.municipality ?? ""].filter(Boolean).join(", ");
    const areaQuery = extracted.municipality ?? extracted.address;

    const [listingsResult, soldResult] = await Promise.all([
      booliRequest("listings", callerId, apiKey, { q: listingQuery, limit: "1" }),
      booliRequest("sold", callerId, apiKey, { q: areaQuery, limit: String(SOLD_COMPARABLES_LIMIT) }),
    ]);

    const errors: string[] = [];
    const data: Record<string, unknown> = {};
    const fields: string[] = [];
    const set = (attribute: string, value: unknown) => {
      if (value === undefined || value === null) return;
      data[attribute] = value;
      fields.push(attribute);
    };

    if ("error" in listingsResult) {
      errors.push(listingsResult.error);
    } else if (listingsResult.items.length > 0) {
      const listing = parseBooliProperty(listingsResult.items[0]);
      if (addressesMatch(extracted.address, listing.streetAddress)) {
        set("booli_id", listing.booliId);
        set("booli_listing_url", listing.url);
        set("property_type_booli", listing.objectType);
        set("asking_price_sek", listing.listPriceSek);
        set("first_price_sek", listing.firstPriceSek);
        set("listing_date", listing.publishedDate);
        set("monthly_fee_sek", listing.monthlyFeeSek);
        set("living_area_m2", listing.livingAreaM2);
        set("additional_area_m2", listing.additionalAreaM2);
        set("lot_area_m2", listing.plotAreaM2);
        set("rooms", listing.rooms);
        set("floor", listing.floor !== undefined ? String(listing.floor) : undefined);
        set("building_year", listing.buildingYear);
        set("balcony", listing.balcony);
        set("patio", listing.patio);
        set("elevator", listing.elevator);
        set("new_construction", listing.newConstruction);
        set("solar_panels", listing.solarPanels);
        set("fireplace", listing.fireplace);
        set("bidding_open", listing.biddingOpen);
        set("mortgage_deed", listing.mortgageDeed);
      } else {
        errors.push(
          `Booli's top /listings match ("${listing.streetAddress ?? "unknown address"}") doesn't match "${extracted.address}" — discarded rather than risk merging the wrong property.`
        );
      }
    }

    if ("error" in soldResult) {
      errors.push(soldResult.error);
    } else if (soldResult.items.length > 0) {
      const summary = summarizeSoldListings(soldResult.items, extracted.address);
      set("previous_sale_price_sek", summary.previousSalePriceSek);
      set("previous_sale_date", summary.previousSaleDate);
      if (summary.comparableSales.length > 0) {
        set("comparable_sales", summary.comparableSales);
        set("comparable_sales_count", summary.comparableSalesCount);
      }
      set("area_median_price_per_m2_sek", summary.areaMedianPricePerM2Sek);
      if (summary.areaSoldPriceTrend.length > 0) set("area_sold_price_trend", summary.areaSoldPriceTrend);
    }

    if (fields.length === 0) {
      return {
        source: {
          ...base,
          status: errors.length > 0 ? "error" : "no_data",
          fields: [],
          detail: errors.length > 0 ? errors.join(" | ") : `No Booli listing or sold data found for "${listingQuery}"`,
        },
        data: {},
      };
    }

    return {
      source: {
        ...base,
        status: "ok",
        fields,
        detail: errors.length > 0 ? `Partial data — ${errors.join(" | ")}` : undefined,
      },
      data,
    };
  },
};
