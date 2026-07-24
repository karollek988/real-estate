import type { DataProvider, ProviderResult } from "./types";
import { fetchJson } from "./httpJson";

/**
 * Real provider: Statistics Sweden (SCB) PxWeb API — free, keyless, open
 * data (docs/data-source-inventory.md entry 5). Reuses the `scb_area_statistics`
 * id/placeholder from the previous milestone.
 *
 * Municipality name → SCB region code, and each table's latest available
 * year, are both resolved at runtime from the table's own metadata (never
 * hardcoded) — SCB tables lag real time by 1-2 years and different tables
 * publish on different schedules, confirmed by testing live (population
 * table's newest year was 2024, not "this year minus one").
 *
 * Sets, only when the query actually returns a value:
 *   population_total, area_population_growth_pct (real, computed from two
 *   years of the same series), median_income_sek_thousands,
 *   share_post_secondary_education_pct.
 *
 * Does NOT set area_median_price_per_m2_sek (Price Analyzer's forward
 * contract) — SCB doesn't publish per-m² housing price by area; that needs
 * a Mäklarstatistik/Valueguard/Booli-comps source, out of scope here.
 */

const POPULATION_TABLE = "https://api.scb.se/OV0104/v1/doris/en/ssd/BE/BE0101/BE0101A/BefolkningNy";
const INCOME_TABLE = "https://api.scb.se/OV0104/v1/doris/en/ssd/HE/HE0110/HE0110A/NetInk02";
const EDUCATION_TABLE = "https://api.scb.se/OV0104/v1/doris/en/ssd/UF/UF0506/UF0506B/Utbildning";

const POST_SECONDARY_LEVELS = new Set(["5", "6", "7"]);

interface PxWebVariable {
  code: string;
  values: string[];
  valueTexts: string[];
}
interface PxWebMetadata {
  variables: PxWebVariable[];
}
interface PxWebDataResponse {
  columns: Array<{ code: string; type: string }>;
  data: Array<{ key: string[]; values: string[] }>;
}

interface TableInfo {
  regionCode: string;
  latestYear: string;
}

async function resolveTableInfo(tableUrl: string, municipality: string): Promise<TableInfo | null> {
  const meta = await fetchJson<PxWebMetadata>(tableUrl);
  if (!meta.ok) return null;

  const region = meta.data.variables.find((v) => v.code === "Region");
  const tid = meta.data.variables.find((v) => v.code === "Tid");
  if (!region || !tid || tid.values.length === 0) return null;

  const target = municipality.trim().toLowerCase();
  const idx = region.valueTexts.findIndex(
    (text, i) => region.values[i].length === 4 && text.trim().toLowerCase() === target
  );
  if (idx < 0) return null;

  return { regionCode: region.values[idx], latestYear: tid.values[tid.values.length - 1] };
}

async function queryPxWeb(
  tableUrl: string,
  query: Array<{ code: string; values: string[] }>
): Promise<PxWebDataResponse | null> {
  const body = {
    query: query.map((q) => ({ code: q.code, selection: { filter: "item", values: q.values } })),
    response: { format: "json" },
  };
  const result = await fetchJson<PxWebDataResponse>(tableUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  return result.ok ? result.data : null;
}

/** PxWeb orders each row's `key` by the table's own column order, not query order — always look up the index. */
function columnIndex(response: PxWebDataResponse, code: string): number {
  return response.columns.findIndex((c) => c.code === code);
}

function sumValues(response: PxWebDataResponse | null): number | null {
  if (!response || response.data.length === 0) return null;
  let total = 0;
  for (const row of response.data) {
    const n = Number.parseFloat(row.values[0]);
    if (!Number.isFinite(n)) return null;
    total += n;
  }
  return total;
}

export const scbDemographicsProvider: DataProvider = {
  id: "scb_area_statistics",
  name: "Area statistics (SCB)",
  kind: "real",

  async collect({ property, extracted }): Promise<ProviderResult> {
    const base = { id: this.id, name: this.name, kind: this.kind } as const;
    // Prefer the canonical, geocoded municipality (matches SCB's own naming);
    // fall back to the raw URL-slug hint if geocoding hasn't run/succeeded.
    const municipality = property.municipality ?? extracted.municipality;

    if (!municipality) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: "No municipality resolved for this property yet." },
        data: {},
      };
    }

    const popInfo = await resolveTableInfo(POPULATION_TABLE, municipality);
    if (!popInfo) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: `"${municipality}" did not match an SCB municipality code.` },
        data: {},
      };
    }

    const data: Record<string, unknown> = {};
    const fields: string[] = [];

    const latestYearNum = Number.parseInt(popInfo.latestYear, 10);
    const [popLatest, popPast] = await Promise.all([
      queryPopulationYear(popInfo.regionCode, popInfo.latestYear),
      queryPopulationYear(popInfo.regionCode, String(latestYearNum - 5)),
    ]);
    if (popLatest !== null) {
      data.population_total = Math.round(popLatest);
      fields.push("population_total");
      if (popPast !== null && popPast > 0) {
        const growthPct = ((popLatest - popPast) / popPast) * 100;
        data.area_population_growth_pct = Math.round(growthPct * 10) / 10;
        fields.push("area_population_growth_pct");
      }
    }

    const incomeInfo = await resolveTableInfo(INCOME_TABLE, municipality);
    if (incomeInfo) {
      const incomeResponse = await queryPxWeb(INCOME_TABLE, [
        { code: "Region", values: [incomeInfo.regionCode] },
        { code: "Kon", values: ["1+2"] },
        { code: "Alder", values: ["20+"] },
        { code: "ContentsCode", values: ["000001ON"] },
        { code: "Tid", values: [incomeInfo.latestYear] },
      ]);
      const medianIncome = incomeResponse?.data[0]
        ? Number.parseFloat(incomeResponse.data[0].values[0])
        : null;
      if (medianIncome !== null && Number.isFinite(medianIncome)) {
        data.median_income_sek_thousands = medianIncome;
        fields.push("median_income_sek_thousands");
      }
    }

    const eduInfo = await resolveTableInfo(EDUCATION_TABLE, municipality);
    if (eduInfo) {
      const eduResponse = await queryPxWeb(EDUCATION_TABLE, [
        { code: "Region", values: [eduInfo.regionCode] },
        { code: "Kon", values: ["1", "2"] },
        { code: "UtbildningsNiva", values: ["1", "2", "3", "4", "5", "6", "7"] },
        { code: "Tid", values: [eduInfo.latestYear] },
      ]);
      if (eduResponse && eduResponse.data.length > 0) {
        const levelIdx = columnIndex(eduResponse, "UtbildningsNiva");
        let postSecondary = 0;
        let total = 0;
        for (const row of eduResponse.data) {
          const level = row.key[levelIdx];
          const n = Number.parseFloat(row.values[0]);
          if (!Number.isFinite(n)) continue;
          total += n;
          if (POST_SECONDARY_LEVELS.has(level)) postSecondary += n;
        }
        if (total > 0) {
          data.share_post_secondary_education_pct = Math.round((postSecondary / total) * 1000) / 10;
          fields.push("share_post_secondary_education_pct");
        }
      }
    }

    if (fields.length === 0) {
      return {
        source: { ...base, status: "no_data", fields: [], detail: `No SCB data returned for ${municipality}.` },
        data: {},
      };
    }

    return { source: { ...base, status: "ok", fields }, data };
  },
};

async function queryPopulationYear(regionCode: string, year: string): Promise<number | null> {
  const response = await queryPxWeb(POPULATION_TABLE, [
    { code: "Region", values: [regionCode] },
    { code: "Civilstand", values: ["OG", "G", "ÄNKL", "SK"] },
    { code: "Alder", values: ["tot"] },
    { code: "Kon", values: ["1", "2"] },
    { code: "ContentsCode", values: ["BE0101N1"] },
    { code: "Tid", values: [year] },
  ]);
  return sumValues(response);
}
