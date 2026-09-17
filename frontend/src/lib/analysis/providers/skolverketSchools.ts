import type { DataProvider, ProviderResult } from "./types";
import { fetchJson, haversineMeters } from "./httpJson";

/**
 * Real provider: Skolverket's Skolenhetsregistret v2 (school-unit register)
 * plus Skolverket's statistikdatabas (PxWeb) for grundskola result
 * statistics. Reuses the `school_ratings` id/placeholder from the previous
 * milestone.
 *
 * Confirmed live (2026-09) before building this:
 * - Skolenhetsregistret v1 is retired ("Aktiv"/"Retired" in its own swagger
 *   config); v2 (`api.skolverket.se/skolenhetsregistret/v2`) is current and
 *   supports real server-side filtering by `municipality_code`,
 *   `school_type` and `status` - unlike v1, whose documented `kommunkod`
 *   filter never actually worked server-side.
 * - The register does NOT include förskola (ages 1-5) at all - it starts at
 *   förskoleklass. Preschool presence/distance comes from OSM instead
 *   (osm.ts's `nearby_preschools`), not from this provider.
 * - SIRIS (siris.skolverket.se), the system named in the original research
 *   as the source of per-school meritvärde/behörighet, has been
 *   decommissioned - it now 404s. Its apparent successor,
 *   Skolverket's PxWeb statistikdatabas, only publishes grundskola result
 *   measures (andel godkända åk9, andel behöriga till gymnasiet) at
 *   huvudman/län/riket granularity, NOT per skolenhet (verified live by
 *   inspecting the table's actual `level` dimension values - all
 *   10-digit organisationsnummer or län/riket codes, never an 8-digit
 *   skolenhetskod).
 *
 * Consequence: a huvudman-level result figure is only attributed to one of
 * its schools when that huvudman runs exactly one active grundskola in this
 * kommun (common for fristående/independent schools, rare for kommunala
 * ones) - every such figure is still labeled by year and source, never
 * presented as if it were a per-school number when it isn't. For every
 * other grundskola, and for every gymnasieskola (out of scope for this
 * first cut), only presence/address/distance is shown - an honest gap, not
 * a missing feature.
 */

const REGISTER_BASE = "https://api.skolverket.se/skolenhetsregistret/v2";
// Skolverket's statistikdatabas (PxWeb) - resolveMunicipalityCode below
// reuses the SCB PxWeb population table only to turn a municipality name
// into its 4-digit SCB/kommun code, which is the same code Skolverket's
// `municipality_code` filter expects. Duplicated from scb.ts rather than
// imported - providers here are deliberately independent of each other.
const POPULATION_TABLE = "https://api.scb.se/OV0104/v1/doris/en/ssd/BE/BE0101/BE0101A/BefolkningNy";
const QUALITY_TABLE =
  "https://statistikdatabasen.skolverket.se/PxWeb/api/v1/sv/Skolverkets_statistikdatabas/Underlag_for_analys_inom_det_nationella_kvalitetssystemet/Grundskola/Grundskola.px";
// PxWeb "mått" (measure) codes in QUALITY_TABLE, confirmed live.
const MEASURE_GODKANT_ALLA_AMNEN_AK9 = "27";
const MEASURE_BEHORIG_GYMNASIET = "28";

const NEAREST_N = 8;
const DETAIL_CONCURRENCY = 15;
const QUALITY_CONCURRENCY = 5;

interface RegisterListItem {
  name: string;
  schoolUnitCode: string;
  status: string;
}
interface RegisterListResponse {
  data?: { attributes?: RegisterListItem[] };
  meta?: { extractDate?: string };
}
interface RegisterDetailResponse {
  data?: {
    attributes?: {
      displayName?: string;
      addresses?: Array<{
        type: string;
        streetAddress?: string;
        postalCode?: string;
        locality?: string;
        geoCoordinates?: { latitude?: string; longitude?: string };
      }>;
    };
  };
  included?: { organizationNumber?: string; attributes?: { displayName?: string } };
}

interface SchoolCandidate {
  code: string;
  name: string;
  address: string | null;
  lat: number;
  lon: number;
  distanceM: number;
  organizationNumber: string | null;
  huvudmanName: string | null;
}

interface QualityResult {
  godkantAllaAmnenPct: number | null;
  gymnasiebehorighetPct: number | null;
  statisticsYear: string;
}

async function resolveMunicipalityCode(municipality: string): Promise<string | null> {
  const meta = await fetchJson<{ variables: Array<{ code: string; values: string[]; valueTexts: string[] }> }>(
    POPULATION_TABLE
  );
  if (!meta.ok) return null;
  const region = meta.data.variables.find((v) => v.code === "Region");
  if (!region) return null;
  const target = municipality.trim().toLowerCase();
  const idx = region.valueTexts.findIndex(
    (text, i) => region.values[i].length === 4 && text.trim().toLowerCase() === target
  );
  return idx >= 0 ? region.values[idx] : null;
}

async function listActiveUnits(
  kommunCode: string,
  schoolType: "GR" | "GY"
): Promise<{ items: RegisterListItem[]; extractDate: string | null }> {
  const url = `${REGISTER_BASE}/school-units?municipality_code=${kommunCode}&school_type=${schoolType}&status=AKTIV`;
  const res = await fetchJson<RegisterListResponse>(url, {}, 15000);
  if (!res.ok) return { items: [], extractDate: null };
  return { items: res.data.data?.attributes ?? [], extractDate: res.data.meta?.extractDate ?? null };
}

async function fetchDetail(code: string): Promise<SchoolCandidate | null> {
  const res = await fetchJson<RegisterDetailResponse>(`${REGISTER_BASE}/school-units/${code}`, {}, 10000);
  if (!res.ok) return null;
  const attrs = res.data.data?.attributes;
  if (!attrs) return null;
  const visit = attrs.addresses?.find((a) => a.type === "BESOKSADRESS") ?? attrs.addresses?.[0];
  const lat = visit?.geoCoordinates?.latitude ? Number.parseFloat(visit.geoCoordinates.latitude) : NaN;
  const lon = visit?.geoCoordinates?.longitude ? Number.parseFloat(visit.geoCoordinates.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const address = visit?.streetAddress
    ? `${visit.streetAddress}, ${[visit.postalCode, visit.locality].filter(Boolean).join(" ")}`.trim()
    : null;
  return {
    code,
    name: attrs.displayName ?? "Okänd skola",
    address,
    lat,
    lon,
    distanceM: 0,
    organizationNumber: res.data.included?.organizationNumber ?? null,
    huvudmanName: res.data.included?.attributes?.displayName ?? null,
  };
}

/** Bounded-concurrency map - Node's fetch runs these genuinely in parallel
 *  (unlike the Python engine's deliberately serialized, rate-limited
 *  client), so a kommun with hundreds of active school units still
 *  completes in a few seconds instead of minutes. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function yearLabel(year: string): string {
  const n = Number.parseInt(year, 10);
  return Number.isFinite(n) ? `${n}/${String(n + 1).slice(-2)}` : year;
}

async function fetchGrundskolaQuality(organizationNumber: string): Promise<QualityResult | null> {
  const body = {
    query: [
      { code: "variable", selection: { filter: "item", values: [MEASURE_GODKANT_ALLA_AMNEN_AK9, MEASURE_BEHORIG_GYMNASIET] } },
      { code: "level", selection: { filter: "item", values: [organizationNumber] } },
    ],
    response: { format: "json" },
  };
  const res = await fetchJson<{ data: Array<{ key: string[]; values: string[] }> }>(
    QUALITY_TABLE,
    { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) },
    15000
  );
  if (!res.ok) return null;

  const byYear = new Map<string, { godkant?: string; behorig?: string }>();
  for (const row of res.data.data) {
    const [variable, , year] = row.key;
    const entry = byYear.get(year) ?? {};
    if (variable === MEASURE_GODKANT_ALLA_AMNEN_AK9) entry.godkant = row.values[0];
    if (variable === MEASURE_BEHORIG_GYMNASIET) entry.behorig = row.values[0];
    byYear.set(year, entry);
  }

  // Most recent year first; PxWeb marks an unpublished/suppressed cell "."
  // rather than omitting the row - never invent a substitute for that.
  const years = Array.from(byYear.keys()).sort().reverse();
  for (const year of years) {
    const entry = byYear.get(year);
    if (!entry) continue;
    const godkant = entry.godkant && entry.godkant !== "." ? Number.parseFloat(entry.godkant.replace(",", ".")) : null;
    const behorig = entry.behorig && entry.behorig !== "." ? Number.parseFloat(entry.behorig.replace(",", ".")) : null;
    if (godkant !== null || behorig !== null) {
      return { godkantAllaAmnenPct: godkant, gymnasiebehorighetPct: behorig, statisticsYear: yearLabel(year) };
    }
  }
  return null;
}

export const skolverketSchoolsProvider: DataProvider = {
  id: "skolverket_schools",
  name: "Skolor i närområdet (Skolverket)",
  kind: "real",
  // Generous: this provider issues one detail request per active school
  // unit in the kommun (up to a few hundred for a big city), run with
  // bounded concurrency - normally seconds, but needs headroom over the
  // pipeline's 25s default for the largest kommuner.
  timeoutMs: 45000,

  async collect({ property, extracted }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;

    if (property.latitude === null || property.longitude === null) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "Property has no coordinates yet (geocoding required first)." },
        data: {},
      };
    }
    const municipality = property.municipality ?? extracted.municipality;
    if (!municipality) {
      return { source: { ...base, status: "no_data", fields: [], detail: "No municipality resolved for this property yet." }, data: {} };
    }

    const kommunCode = await resolveMunicipalityCode(municipality);
    if (!kommunCode) {
      return { source: { ...base, status: "no_data", fields: [], detail: `"${municipality}" did not match a municipality code.` }, data: {} };
    }

    const origin = { lat: property.latitude, lon: property.longitude };

    const [grList, gyList] = await Promise.all([
      listActiveUnits(kommunCode, "GR"),
      listActiveUnits(kommunCode, "GY"),
    ]);

    if (grList.items.length === 0 && gyList.items.length === 0) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: `No active grundskolor or gymnasieskolor found in Skolverket's register for ${municipality}.` },
        data: {},
      };
    }

    const extractDate = grList.extractDate ?? gyList.extractDate;

    const [grDetails, gyDetails] = await Promise.all([
      mapWithConcurrency(grList.items, DETAIL_CONCURRENCY, (item) => fetchDetail(item.schoolUnitCode)),
      mapWithConcurrency(gyList.items, DETAIL_CONCURRENCY, (item) => fetchDetail(item.schoolUnitCode)),
    ]);

    const withDistance = (list: Array<SchoolCandidate | null>): SchoolCandidate[] =>
      list
        .filter((c): c is SchoolCandidate => c !== null)
        .map((c) => ({ ...c, distanceM: haversineMeters(origin, { lat: c.lat, lon: c.lon }) }))
        .sort((a, b) => a.distanceM - b.distanceM);

    const grCandidates = withDistance(grDetails);
    const gyCandidates = withDistance(gyDetails);

    // Single-school-in-kommun heuristic, computed over the *full* kommun
    // set (not just the nearest N) - a huvudman-level figure is only shown
    // when exactly one active grundskola in this kommun shares that
    // organisationsnummer. This can occasionally miss the (rare) case of a
    // single-per-kommun school whose huvudman also runs a school in a
    // different kommun, but it never over-attributes a same-kommun chain's
    // (e.g. a municipality's) average to one of its own campuses.
    const orgnrCounts = new Map<string, number>();
    for (const c of grCandidates) {
      if (c.organizationNumber) orgnrCounts.set(c.organizationNumber, (orgnrCounts.get(c.organizationNumber) ?? 0) + 1);
    }

    const nearestGr = grCandidates.slice(0, NEAREST_N);
    const nearestGy = gyCandidates.slice(0, NEAREST_N);

    const singleSchoolNearby = nearestGr.filter(
      (c) => c.organizationNumber && orgnrCounts.get(c.organizationNumber) === 1
    );
    const qualityResults = await mapWithConcurrency(singleSchoolNearby, QUALITY_CONCURRENCY, async (c) => ({
      code: c.code,
      quality: await fetchGrundskolaQuality(c.organizationNumber as string),
    }));
    const qualityByCode = new Map<string, QualityResult>();
    let statisticsYear: string | null = null;
    for (const { code, quality } of qualityResults) {
      if (quality) {
        qualityByCode.set(code, quality);
        statisticsYear = statisticsYear ?? quality.statisticsYear;
      }
    }

    const data: Record<string, unknown> = {};
    const fields: string[] = [];

    if (nearestGr.length > 0) {
      data.nearby_primary_schools = nearestGr.map((c) => ({
        name: c.name,
        address: c.address,
        distanceM: Math.round(c.distanceM),
        huvudman: c.huvudmanName,
        result: qualityByCode.get(c.code) ?? null,
      }));
      fields.push("nearby_primary_schools");
    }
    if (nearestGy.length > 0) {
      data.nearby_high_schools = nearestGy.map((c) => ({
        name: c.name,
        address: c.address,
        distanceM: Math.round(c.distanceM),
        huvudman: c.huvudmanName,
      }));
      fields.push("nearby_high_schools");
    }
    if (extractDate) {
      data.schools_register_extract_date = extractDate;
      fields.push("schools_register_extract_date");
    }
    if (statisticsYear) {
      data.schools_statistics_year = statisticsYear;
      fields.push("schools_statistics_year");
    }

    return { source: { ...base, status: "ok", fields }, data };
  },
};
