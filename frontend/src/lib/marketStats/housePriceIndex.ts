import { fetchJson } from "@/lib/analysis/providers/httpJson";

/**
 * Live national house price index ("bostadspriser") from SCB's PxWeb API —
 * free, keyless, official (docs/data-source-inventory.md entry 5). Table
 * BO0501A/FastpiPSRegKv, region "00" (Sweden), content code BO0501K2
 * ("Index"), quarterly. Covers one- and two-dwelling buildings for
 * permanent living ("småhus") — SCB has no equivalent national index for
 * tenant-owned flats, so this specifically reflects house prices, labeled
 * as such wherever it's shown.
 */

const TABLE_URL = "https://api.scb.se/OV0104/v1/doris/en/ssd/BO/BO0501/BO0501A/FastpiPSRegKv";
const INDEX_CODE = "BO0501K2";
const NATIONAL_REGION = "00";
const QUARTERS_TO_SHOW = 13;

interface PxWebVariable {
  code: string;
  values: string[];
}
interface PxWebMetadata {
  variables: PxWebVariable[];
}
interface PxWebDataResponse {
  data: Array<{ key: string[]; values: string[] }>;
}

export interface HousePriceIndexSeries {
  values: number[];
  quarterLabels: string[];
  latest: number;
  yoyChangePct: number | null;
  asOf: string;
}

async function queryPxWeb(
  query: Array<{ code: string; values: string[] }>
): Promise<PxWebDataResponse | null> {
  const body = {
    query: query.map((q) => ({ code: q.code, selection: { filter: "item", values: q.values } })),
    response: { format: "json" },
  };
  const result = await fetchJson<PxWebDataResponse>(
    TABLE_URL,
    { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) },
    10000
  );
  return result.ok ? result.data : null;
}

export async function getHousePriceIndexSeries(): Promise<HousePriceIndexSeries | null> {
  const meta = await fetchJson<PxWebMetadata>(TABLE_URL, {}, 10000);
  if (!meta.ok) return null;
  const tid = meta.data.variables.find((v) => v.code === "Tid");
  if (!tid || tid.values.length === 0) return null;

  // Fetch a bit further back than we display so the year-over-year change
  // has a real same-quarter-last-year value to compare against.
  const quarters = tid.values.slice(-(QUARTERS_TO_SHOW + 4));
  const response = await queryPxWeb([
    { code: "Region", values: [NATIONAL_REGION] },
    { code: "ContentsCode", values: [INDEX_CODE] },
    { code: "Tid", values: quarters },
  ]);
  if (!response || response.data.length === 0) return null;

  const byQuarter = new Map<string, number>();
  for (const row of response.data) {
    const quarter = row.key[1];
    const value = Number.parseFloat(row.values[0]);
    if (Number.isFinite(value)) byQuarter.set(quarter, value);
  }

  const displayed = quarters.slice(-QUARTERS_TO_SHOW).filter((q) => byQuarter.has(q));
  if (displayed.length === 0) return null;

  const values = displayed.map((q) => byQuarter.get(q)!);
  const latestQuarter = displayed[displayed.length - 1];
  const latest = byQuarter.get(latestQuarter)!;

  const [latestYear, latestQ] = latestQuarter.split("K").map(Number);
  const yearAgoQuarter = `${latestYear - 1}K${latestQ}`;
  const yearAgoValue = byQuarter.get(yearAgoQuarter);
  const yoyChangePct = yearAgoValue ? Math.round(((latest - yearAgoValue) / yearAgoValue) * 1000) / 10 : null;

  return {
    values,
    quarterLabels: displayed,
    latest,
    yoyChangePct,
    asOf: latestQuarter,
  };
}
