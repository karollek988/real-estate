/**
 * Live "kvadratmeterpris" (price per m²) data scraped from Svensk
 * Mäklarstatistik's public area pages (docs/data-source-inventory.md entry
 * 13 — "Free aggregates only" on their public website; the full API is
 * partner-only). No official open API exists for this figure: SCB does not
 * publish per-m² prices for tenant-owned flats (bostadsrätter) — confirmed
 * both in src/lib/analysis/providers/scb.ts's own findings and by
 * inspecting SCB's real-estate PxWeb tables directly (only average total
 * price and index values, never per-m²). Svensk Mäklarstatistik is the
 * standard industry reference for this exact figure in Swedish media.
 *
 * Each area page is server-rendered HTML (verified live, no client-side
 * rendering involved) with a stable, semantic structure:
 *   <div class="housing-tenure" data-tenure="bostadsratter"> ... one block
 *   with class "area-stats area-stats--primary" (rolling 3 months) then
 *   one with "area-stats--secondary" (rolling 12 months), each containing
 *   4 `<span class="area-stat__value">` entries in a fixed order: kr/m²,
 *   average price, number sold, price change %.
 * This parses the 12-month block specifically, scoped to the
 * data-tenure="bostadsratter" section so it never picks up villa/holiday-home
 * figures from the same page.
 */

const BASE_URL = "https://www.maklarstatistik.se/omrade/riket/";
const FETCH_TIMEOUT_MS = 15000;

const AREAS: Array<{ name: string; path: string }> = [
  { name: "Stockholm", path: "stockholms-lan/stockholm/" },
  { name: "Göteborg", path: "vastra-gotalands-lan/goteborg/" },
  { name: "Riksgenomsnitt", path: "" },
  { name: "Malmö", path: "skane-lan/malmo/" },
  { name: "Uppsala", path: "uppsala-lan/uppsala/" },
];

export interface AreaPrice {
  name: string;
  pricePerM2: number;
  changePct: number | null;
}

export interface SqmPriceData {
  areas: AreaPrice[];
  asOf: string | null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KopanalysStatsBot/1.0)" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseSwedishNumber(raw: string): number {
  return Number.parseFloat(raw.replace(/[^\d.,-]/g, "").replace(/\s/g, "").replace(",", "."));
}

/** Extracts the "Uppdaterad: 8 juli 2026" date shown on every area page. */
function extractUpdatedDate(html: string): string | null {
  const match = html.match(/uppdaterad[a-z]*:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
  return match ? match[1].trim() : null;
}

function extractBostadsratterStats(html: string): { pricePerM2: number; changePct: number | null } | null {
  const tenureIdx = html.indexOf('data-tenure="bostadsratter"');
  if (tenureIdx === -1) return null;

  const nextTenureIdx = html.indexOf("data-tenure=", tenureIdx + 1);
  const section = html.slice(tenureIdx, nextTenureIdx === -1 ? html.length : nextTenureIdx);

  const secondaryIdx = section.indexOf("area-stats--secondary");
  if (secondaryIdx === -1) return null;

  const statsSection = section.slice(secondaryIdx);
  const valueMatches = [...statsSection.matchAll(/area-stat__value[^"]*"[^>]*>\s*([^<]+)</g)].slice(0, 4);
  if (valueMatches.length < 4) return null;

  const pricePerM2 = parseSwedishNumber(valueMatches[0][1]);
  const changePct = parseSwedishNumber(valueMatches[3][1]);
  if (!Number.isFinite(pricePerM2)) return null;

  return { pricePerM2: Math.round(pricePerM2), changePct: Number.isFinite(changePct) ? changePct : null };
}

export async function getPricePerSqmByArea(): Promise<SqmPriceData | null> {
  const results = await Promise.all(
    AREAS.map(async (area) => {
      const html = await fetchHtml(`${BASE_URL}${area.path}`);
      if (!html) return null;
      const stats = extractBostadsratterStats(html);
      const updated = extractUpdatedDate(html);
      return stats ? { name: area.name, ...stats, updated } : null;
    })
  );

  const areas: AreaPrice[] = [];
  let asOf: string | null = null;
  for (const r of results) {
    if (!r) continue;
    areas.push({ name: r.name, pricePerM2: r.pricePerM2, changePct: r.changePct });
    if (!asOf && r.updated) asOf = r.updated;
  }

  if (areas.length === 0) return null;
  return { areas, asOf };
}
