import type { DataProvider, ProviderResult } from "./types";
import { fetchJson, getNested, numberField, stringField, booleanField } from "./httpJson.ts";
import { addressesMatch } from "./booli.ts";
import { summarizeSold, type RawSoldEntry } from "./soldSummary.ts";

/**
 * Real provider: Parse.bot's "Booli.se API" scraper-as-a-service
 * (https://parse.bot/marketplace/e0286288-9caf-40e1-83f2-eb4dbbc95fab/booli-se-api).
 * A FALLBACK behind Hemnet (hemnetPage.ts) and the direct Booli API
 * (booli.ts) — identityTrust.ts ensures it only ever fills a gap those two
 * leave, never overwrites a value they already found.
 *
 * Auth: header X-API-Key. Search (`search_listings_for_sale`) is free-text,
 * the same class of ambiguity as booli.ts's `/listings?q=` — reuses that
 * module's addressesMatch() guard rather than duplicating it.
 *
 * FIELD SHAPES CONFIRMED LIVE (2026-07-22, two real get_listing_detail
 * calls, not fabricated from docs alone): listPrice/rent/operatingCost/
 * livingArea/rooms are {raw,value,formatted,unit} objects; floor is
 * {raw:number}; constructionYear is a plain number; amenities is a
 * presence-only [{key,label}] list (absence of a key means "not reported",
 * NEVER treated as false here); the BRF name has no dedicated field — it's
 * the last breadcrumbs[] entry's label when tenureForm is "Bostadsrätt" and
 * that entry's url matches /bostadsrattsforening/<housingCoop.id>; the
 * agency name is under a literal object key that includes a JSON-args
 * suffix, agency({"queryContext":...}) — matched by prefix, not exact key.
 *
 * KNOWN LIMITATION: broker/agent PERSON name is not available anywhere in
 * this API (only a numeric agentId with no name resolution) — this
 * provider never sets `broker`.
 *
 * KNOWN LIMITATION: photo objects (images[]) carry id/width/height/alt/
 * primaryLabel but NO url field, and Parse.bot's own docs only say a URL is
 * "constructible via Booli's CDN" with no pattern given anywhere. Rather
 * than fabricate a CDN URL scheme, this provider does not populate
 * image_urls/floorplan_urls at all — only an informational photo count and
 * floor-plan-presence flag (parsebot_photo_count/parsebot_has_floorplan),
 * which buildAnalysis.ts/build.ts don't read.
 *
 * UNVERIFIED: search_sold_listings' exact object shape was not confirmed
 * live (only documented as "location query only, no filters") — assumed to
 * follow the same flat convention search_listings_for_sale confirmed. If
 * that assumption is wrong, entries are silently filtered out (missing
 * soldPriceSek) rather than crashing or producing wrong comparables.
 *
 * LATENCY (measured live 2026-07-23): this is a live scraper, not a cached
 * API — response times varied from ~7s to 42s across real queries in
 * testing. A timeout tuned for a normal REST call (the 8s used by booli.ts,
 * Booli's own direct API) would false-negative most of the time. Set well
 * above the worst observed case rather than the more typical few seconds.
 *
 * SERIOUS LIMITATION, DISCOVERED DURING VERIFICATION (2026-07-23): despite
 * Parse.bot's own docs describing `query` as a "Location search
 * (municipality, area, street)", it does NOT filter results by location in
 * practice. Three different real requests confirmed this: `query="Stallgatan
 * 16A, Upplands Väsby"` and `query="Trollhattan"` returned byte-identical
 * first pages, and `page=2` of the same query returned a *different* but
 * still clearly nationwide-unfiltered set (Malmö, Jokkmokk, Billdal, ...) —
 * i.e. `search_listings_for_sale` currently just paginates through recent
 * listings nationwide, ignoring `query` entirely. Consequently
 * `addressesMatch()` correctly rejects every candidate in real runs (it is
 * NOT a bug in this file — it is exactly the intended fail-safe behavior:
 * never merge an unrelated property), but this means the provider currently
 * contributes near-zero real data in practice until Parse.bot fixes
 * location search on their end. `get_listing_detail`/`get_listing_photos`
 * DO return correct, real data for a given `listing_id` (verified
 * separately, see the field-shape notes above) — it is specifically the
 * discovery/search step that is broken, not the detail endpoints.
 */

const REQUEST_TIMEOUT_MS = 45000;
const MAX_COMPARABLES_RETURNED = 15;
const SEARCH_CANDIDATES_TO_SCAN = 10;
const RETRY_DELAY_MS = 2000;

/**
 * fetchJson with one retry on failure, scoped to this provider only (the
 * shared httpJson.ts helper stays untouched — other providers hit fast,
 * cached APIs where a silent extra 45s retry would be the wrong default).
 * Parse.bot is a live scraper (7-42s per call, per the field notes above),
 * so a single dropped connection or transient 5xx shouldn't count as
 * "no data" the way it would for a normal REST call.
 */
async function fetchJsonWithRetry<T>(url: string, init: RequestInit, timeoutMs: number) {
  const first = await fetchJson<T>(url, init, timeoutMs);
  if (first.ok) return first;
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  return fetchJson<T>(url, init, timeoutMs);
}

// Fields this source could ever contribute — if every one is already
// known, skip the network entirely (free tier: 100 credits/month, 5 req/min).
const CANDIDATE_ATTRIBUTE_FIELDS = [
  "asking_price_sek",
  "monthly_fee_sek",
  "operating_costs_sek",
  "living_area_m2",
  "rooms",
  "floor",
  "building_year",
  "housing_association",
  "balcony",
  "elevator",
  "patio",
  "fireplace",
  "agency",
  "description",
  "previous_sale_price_sek",
  "comparable_sales",
];

const AMENITY_KEY_TO_ATTRIBUTE: Record<string, string> = {
  balcony: "balcony",
  elevator: "elevator",
  patio: "patio",
  fireplace: "fireplace",
  storage: "storage",
  parking: "parking",
  solar_panels: "solar_panels",
  solarpanels: "solar_panels",
};

/** Reads a Parse.bot "quantity" field, which is either a plain number or a {raw|value} object. */
export function quantityNumber(obj: Record<string, unknown>, path: string[]): number | undefined {
  const node = getNested(obj, path);
  if (typeof node === "number") return Number.isFinite(node) ? node : undefined;
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.raw === "number" && Number.isFinite(o.raw)) return o.raw;
    if (typeof o.value === "string") {
      const parsed = Number.parseFloat(o.value.replace(/[^\d.,-]/g, "").replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

/** BRF name has no dedicated field — it's the last breadcrumb when it points at this property's housing co-op. */
export function extractHousingAssociationName(detail: Record<string, unknown>): string | undefined {
  const housingCoopId = getNested(detail, ["housingCoop", "id"]);
  const breadcrumbs = getNested(detail, ["breadcrumbs"]);
  if (housingCoopId === undefined || housingCoopId === null || !Array.isArray(breadcrumbs) || breadcrumbs.length === 0) {
    return undefined;
  }
  const last = breadcrumbs[breadcrumbs.length - 1] as Record<string, unknown> | undefined;
  const url = typeof last?.url === "string" ? last.url : "";
  if (!url.includes(`/bostadsrattsforening/${housingCoopId}`)) return undefined;
  const label = typeof last?.label === "string" ? last.label.trim() : "";
  return label !== "" ? label : undefined;
}

/** Agency name lives under a literal key with a JSON-args suffix, e.g. agency({"queryContext":"PROPERTY_PAGE_LISTING"}). */
export function extractAgencyName(detail: Record<string, unknown>): string | undefined {
  const key = Object.keys(detail).find((k) => k.startsWith("agency("));
  const node = key ? detail[key] : undefined;
  const name = node && typeof node === "object" ? (node as Record<string, unknown>).name : undefined;
  return typeof name === "string" && name.trim() !== "" ? name.trim() : undefined;
}

function extractDescription(detail: Record<string, unknown>): string | undefined {
  for (const key of ["description", "descriptionText", "listingText"]) {
    const v = stringField(detail, [key]);
    if (v) return v;
  }
  return undefined;
}

/** Amenities are a PRESENCE list, unlike booli.ts's explicit 0/1 fields — absence means "not reported", never asserted false. */
export function extractAmenityFlags(detail: Record<string, unknown>): Record<string, true> {
  const amenities = getNested(detail, ["amenities"]);
  const out: Record<string, true> = {};
  if (!Array.isArray(amenities)) return out;
  for (const entry of amenities) {
    const key = (entry as Record<string, unknown> | undefined)?.key;
    if (typeof key !== "string") continue;
    const attr = AMENITY_KEY_TO_ATTRIBUTE[key.toLowerCase()];
    if (attr) out[attr] = true;
  }
  return out;
}

export function summarizePhotos(images: unknown): { count: number; hasFloorplan: boolean } {
  if (!Array.isArray(images)) return { count: 0, hasFloorplan: false };
  return {
    count: images.length,
    hasFloorplan: images.some((p) => (p as Record<string, unknown> | undefined)?.primaryLabel === "floorplan"),
  };
}

export const parseBotBooliProvider: DataProvider = {
  id: "parsebot_booli",
  name: "Listing & sold-price data (Parse.bot Booli.se API)",
  kind: "real",

  async collect({ extracted, property }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;
    const apiKey = process.env.PARSE_API_KEY;
    const baseUrl = process.env.PARSE_BOOLI_BASE_URL;

    if (!apiKey || !baseUrl) {
      return {
        source: {
          ...base,
          status: "not_connected",
          fields: [],
          detail: "Parse.bot credentials not configured (set PARSE_API_KEY and PARSE_BOOLI_BASE_URL).",
        },
        data: {},
      };
    }

    const alreadyComplete = CANDIDATE_ATTRIBUTE_FIELDS.every((f) => {
      const v = property.attributes[f];
      return v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0);
    });
    if (alreadyComplete) {
      return {
        source: {
          ...base,
          status: "no_data",
          fields: [],
          detail: "Skipped — every field this source could contribute is already populated (credit conservation).",
        },
        data: {},
      };
    }

    const root = baseUrl.replace(/\/$/, "");
    const headers = { "X-API-Key": apiKey };
    const query = [extracted.address, extracted.municipality ?? ""].filter(Boolean).join(", ");

    const searchRes = await fetchJsonWithRetry<{ status: string; data?: { listings?: Record<string, unknown>[] } }>(
      `${root}/search_listings_for_sale?${new URLSearchParams({ query })}`,
      { headers },
      REQUEST_TIMEOUT_MS
    );
    if (!searchRes.ok) {
      return {
        source: { ...base, status: "error", fields: [], detail: `Parse.bot search failed: ${searchRes.error}` },
        data: {},
      };
    }

    const candidates = searchRes.data.data?.listings ?? [];
    const matched = candidates
      .slice(0, SEARCH_CANDIDATES_TO_SCAN)
      .find((c) => addressesMatch(extracted.address, stringField(c, ["streetAddress"])));

    if (!matched) {
      return {
        source: {
          ...base,
          status: "no_data",
          fields: [],
          detail: `No Parse.bot Booli.se search result matched "${extracted.address}" (${candidates.length} candidate(s) checked).`,
        },
        data: {},
      };
    }

    const booliId = numberField(matched, ["booliId"]);
    if (booliId === undefined) {
      return {
        source: { ...base, status: "error", fields: [], detail: "Matched search result had no booliId." },
        data: {},
      };
    }

    const [detailRes, soldRes] = await Promise.all([
      fetchJsonWithRetry<{ status: string; data?: Record<string, unknown> }>(
        `${root}/get_listing_detail?${new URLSearchParams({ listing_id: String(booliId) })}`,
        { headers },
        REQUEST_TIMEOUT_MS
      ),
      fetchJsonWithRetry<{ status: string; data?: { listings?: Record<string, unknown>[] } }>(
        `${root}/search_sold_listings?${new URLSearchParams({ query: extracted.municipality ?? extracted.address })}`,
        { headers },
        REQUEST_TIMEOUT_MS
      ),
    ]);

    const errors: string[] = [];
    const data: Record<string, unknown> = {};
    const fields: string[] = [];
    const set = (attribute: string, value: unknown) => {
      if (value === undefined || value === null) return;
      data[attribute] = value;
      fields.push(attribute);
    };
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (!detailRes.ok) {
      errors.push(`Parse.bot detail fetch failed: ${detailRes.error}`);
    } else {
      const detail = detailRes.data.data ?? {};
      set("asking_price_sek", quantityNumber(detail, ["listPrice"]));
      set("monthly_fee_sek", quantityNumber(detail, ["rent"]));
      set("operating_costs_sek", quantityNumber(detail, ["operatingCost"]));
      set("living_area_m2", quantityNumber(detail, ["livingArea"]));
      set("rooms", quantityNumber(detail, ["rooms"]));
      const floor = numberField(detail, ["floor", "raw"]);
      set("floor", floor !== undefined ? String(floor) : undefined);
      set("building_year", numberField(detail, ["constructionYear"]));
      set("property_type_booli", stringField(detail, ["objectType"]));
      set("booli_id", booliId);
      set("booli_listing_url", stringField(detail, ["url"]) ?? stringField(matched, ["url"]));
      set("housing_association", extractHousingAssociationName(detail));
      set("agency", extractAgencyName(detail));
      set("description", extractDescription(detail));
      set("mortgage_deed", booleanField(detail, ["mortgageDeed"]));
      for (const [attr, value] of Object.entries(extractAmenityFlags(detail))) set(attr, value);
      const photos = summarizePhotos(detail.images);
      if (photos.count > 0) {
        set("parsebot_photo_count", photos.count);
        set("parsebot_has_floorplan", photos.hasFloorplan);
      }
      latitude = numberField(matched, ["latitude"]);
      longitude = numberField(matched, ["longitude"]);
    }

    if (!soldRes.ok) {
      errors.push(`Parse.bot sold-listings fetch failed: ${soldRes.error}`);
    } else {
      const soldListings = soldRes.data.data?.listings ?? [];
      const entries: RawSoldEntry[] = soldListings
        .map((s) => ({
          streetAddress: stringField(s, ["streetAddress"]) ?? null,
          soldPriceSek: quantityNumber(s, ["soldPrice"]),
          soldDate: stringField(s, ["soldDate"]) ?? null,
          livingAreaM2: quantityNumber(s, ["livingArea"]) ?? null,
          rooms: quantityNumber(s, ["rooms"]) ?? null,
        }))
        .filter((e): e is RawSoldEntry & { soldPriceSek: number } => e.soldPriceSek !== undefined);

      if (entries.length > 0) {
        const summary = summarizeSold(entries, extracted.address, addressesMatch, {
          maxComparablesReturned: MAX_COMPARABLES_RETURNED,
        });
        set("previous_sale_price_sek", summary.previousSalePriceSek);
        set("previous_sale_date", summary.previousSaleDate);
        if (summary.comparableSales.length > 0) {
          set("comparable_sales", summary.comparableSales);
          set("comparable_sales_count", summary.comparableSalesCount);
        }
        set("area_median_price_per_m2_sek", summary.areaMedianPricePerM2Sek);
        if (summary.areaSoldPriceTrend.length > 0) set("area_sold_price_trend", summary.areaSoldPriceTrend);
      }
    }

    if (fields.length === 0) {
      return {
        source: {
          ...base,
          status: errors.length > 0 ? "error" : "no_data",
          fields: [],
          detail: errors.length > 0 ? errors.join(" | ") : `No usable data in Parse.bot's response for "${query}"`,
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
      // No framework-level trust guard exists for propertyPatch (only
      // attributes go through identityTrust.ts) — self-guard by only ever
      // filling coordinates when the property doesn't have any yet.
      propertyPatch:
        property.latitude === null &&
        property.longitude === null &&
        latitude !== undefined &&
        longitude !== undefined
          ? { latitude, longitude }
          : undefined,
    };
  },
};
