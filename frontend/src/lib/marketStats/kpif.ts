import { fetchJson } from "@/lib/analysis/providers/httpJson";

/**
 * Live inflation (KPIF — Consumer Price Index with a fixed interest rate,
 * the Riksbank's actual target measure) from SCB's PxWeb API — free,
 * keyless, official (docs/data-source-inventory.md entry 5). Table
 * PR0101G/KPIF2020, content code 000007ZM ("CPIF, annual changes"), which
 * is already the year-over-year inflation rate — no extra computation
 * needed. Confirmed live 2026-07: covers 1987M01 through the latest
 * published month, usually 1 month behind the calendar (SCB publishes
 * mid-month for the prior month).
 */

const TABLE_URL = "https://api.scb.se/OV0104/v1/doris/en/ssd/PR/PR0101/PR0101G/KPIF2020";
const ANNUAL_CHANGE_CODE = "000007ZM";
const MONTHS_TO_SHOW = 13;

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

export interface InflationSeries {
  values: number[];
  monthLabels: string[];
  latest: number;
  latestMonth: string;
  asOf: string;
}

const SWEDISH_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

function toDisplayMonth(pxWebMonth: string): string {
  const m = Number.parseInt(pxWebMonth.slice(5, 7), 10);
  return SWEDISH_MONTHS[m - 1] ?? pxWebMonth;
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

export async function getInflationSeries(): Promise<InflationSeries | null> {
  const meta = await fetchJson<PxWebMetadata>(TABLE_URL, {}, 10000);
  if (!meta.ok) return null;
  const tid = meta.data.variables.find((v) => v.code === "Tid");
  if (!tid || tid.values.length === 0) return null;

  const months = tid.values.slice(-MONTHS_TO_SHOW);
  const response = await queryPxWeb([
    { code: "ContentsCode", values: [ANNUAL_CHANGE_CODE] },
    { code: "Tid", values: months },
  ]);
  if (!response || response.data.length === 0) return null;

  // PxWeb returns rows in the order requested for a single-selection Tid query.
  const byMonth = new Map<string, number>();
  for (const row of response.data) {
    const month = row.key[0];
    const value = Number.parseFloat(row.values[0]);
    if (Number.isFinite(value)) byMonth.set(month, value);
  }

  const monthLabels: string[] = [];
  const values: number[] = [];
  for (const month of months) {
    const value = byMonth.get(month);
    if (value === undefined) continue;
    monthLabels.push(toDisplayMonth(month));
    values.push(value);
  }
  if (values.length === 0) return null;

  const latestMonth = months.filter((m) => byMonth.has(m)).slice(-1)[0];

  return {
    values,
    monthLabels,
    latest: values[values.length - 1],
    latestMonth,
    asOf: latestMonth,
  };
}
