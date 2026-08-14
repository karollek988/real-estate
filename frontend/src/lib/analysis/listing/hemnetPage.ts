/**
 * Hemnet listing page scraper — public entry point.
 *
 * Fetches the listing page and extracts every available field by running
 * four extraction sources over it, highest confidence first, and merging
 * every candidate they produce (see hemnetExtract/merge.ts):
 *
 *   1. Apollo/Next.js application state (hemnetExtract/apollo.ts) — the
 *      page's own structured data. Primary source: the fact panel, amenities,
 *      and full description are rendered client-side from this and are not
 *      present anywhere else in the page.
 *   2. JSON-LD (hemnetExtract/jsonld.ts) — standardized schema.org markup.
 *   3. Semantic HTML (hemnetExtract/semanticHtml.ts) — meta tags and
 *      label/value structure identified by tag shape and Swedish label text,
 *      never by CSS module class names.
 *   4. Regex over raw text (hemnetExtract/regexFallback.ts) — last resort,
 *      used only for whatever the structured sources above didn't find.
 *
 * All four always run; none of them stops the others from contributing.
 * This is the primary data recovery path — without it, the only data source
 * is the URL slug (which lacks price, area, fees, images, etc.), see
 * listing/hemnet.ts.
 */
import { extractApollo } from "./hemnetExtract/apollo.ts";
import { extractJsonLd } from "./hemnetExtract/jsonld.ts";
import { mergeExtractions } from "./hemnetExtract/merge.ts";
import { extractRegexFallback } from "./hemnetExtract/regexFallback.ts";
import { extractSemanticHtml } from "./hemnetExtract/semanticHtml.ts";
import type { ExtractionResult, HemnetPageData } from "./hemnetExtract/types.ts";

export type { HemnetPageData } from "./hemnetExtract/types.ts";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Hemnet's Cloudflare protection returns one of these to a plain server-side
 * fetch (proven live: curl with the same headers gets 200, Node's fetch()
 * gets 403) — the same signal BRF-Scraper's HemnetProvider already escalates
 * on (discovery/hemnet_provider.py::_fetch_html, `status_code in (403, 429, 503)`).
 */
const BOT_BLOCKED_STATUSES = new Set([403, 429, 503]);

/**
 * The 4 fields the report can't be generated without (asking price, monthly
 * fee, room count, living area) — see pipeline.ts's essential-field gate.
 * Used here only to decide whether a "successful" fetch was actually worth
 * anything: Hemnet occasionally serves a 200-status interstitial ("are you
 * human?", a soft-404, a stripped listing-removed page) that direct fetch
 * can't distinguish from a real listing by status code alone.
 */
function hasEssentialFields(data: HemnetPageData): boolean {
  return (
    data.asking_price_sek !== null ||
    data.monthly_fee_sek !== null ||
    data.rooms !== null ||
    data.living_area_m2 !== null
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a Hemnet listing page and extract all available property data.
 *
 * Tries a direct fetch first (fast, no dependency), retrying once on a
 * transient network error. Escalates to the Python engine's Camoufox (real
 * Firefox) browser-fetch bridge — POST /api/browser-fetch (api/server.py), a
 * thin wrapper around the same `_browser_fetch()` already used by the BRF
 * acquisition pipeline — on ANY failure to get a usable page: a blocked
 * status (403/429/503), any other non-2xx status, a network error, or a 2xx
 * response that parsed to none of the essential fields (an interstitial or
 * stripped page). This reuses that existing anti-detection mechanism instead
 * of adding a second browser stack to the TypeScript side. Returns null only
 * when both the direct fetch and the browser bridge fail to produce a page
 * with at least one essential field (or the bridge isn't configured — no
 * PYTHON_ENGINE_API_URL — in which case only the direct fetch ever ran).
 */
export async function scrapeHemnetPage(hemnetUrl: string): Promise<HemnetPageData | null> {
  const direct = await fetchDirect(hemnetUrl);
  if (direct.html !== null) {
    const parsed = parseHemnetHtml(direct.html);
    if (hasEssentialFields(parsed)) {
      console.log(`[hemnetPage] direct fetch OK for ${hemnetUrl}`);
      return parsed;
    }
    console.warn(`[hemnetPage] direct fetch returned a page with no essential fields (likely an interstitial), escalating for ${hemnetUrl}`);
  } else {
    console.warn(`[hemnetPage] direct fetch failed, escalating to browser bridge for ${hemnetUrl}`);
  }

  const viaBrowser = await fetchViaBrowserBridge(hemnetUrl);
  if (viaBrowser !== null) {
    const parsed = parseHemnetHtml(viaBrowser);
    if (hasEssentialFields(parsed)) {
      console.log(`[hemnetPage] browser bridge OK for ${hemnetUrl}`);
      return parsed;
    }
    console.error(`[hemnetPage] browser bridge also returned a page with no essential fields for ${hemnetUrl}`);
    return parsed;
  }
  console.error(`[hemnetPage] browser bridge also failed for ${hemnetUrl}`);
  return null;
}

async function fetchDirectOnce(hemnetUrl: string): Promise<{ html: string | null; blocked: boolean; networkError: boolean }> {
  try {
    const res = await fetch(hemnetUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (res.ok) return { html: await res.text(), blocked: false, networkError: false };
    const blocked = BOT_BLOCKED_STATUSES.has(res.status);
    if (blocked) {
      console.warn(`[hemnetPage] fetchDirect blocked with status ${res.status} for ${hemnetUrl}`);
    } else {
      console.error(`[hemnetPage] fetchDirect returned status ${res.status} for ${hemnetUrl}`);
    }
    return { html: null, blocked, networkError: false };
  } catch (err) {
    console.error(`[hemnetPage] fetchDirect network error for ${hemnetUrl}:`, err);
    return { html: null, blocked: false, networkError: true };
  }
}

/**
 * One retry on a transient network error only (a blocked/non-2xx status
 * won't fix itself on immediate retry — that's what the browser bridge
 * escalation is for). Any non-2xx status or exhausted retry always escalates
 * — previously a plain non-block status (e.g. a transient 500 from Hemnet's
 * own origin, not Cloudflare) silently gave up with no fallback attempt.
 */
async function fetchDirect(hemnetUrl: string): Promise<{ html: string | null; shouldEscalate: boolean }> {
  let attempt = await fetchDirectOnce(hemnetUrl);
  if (attempt.html === null && attempt.networkError) {
    await delay(600);
    attempt = await fetchDirectOnce(hemnetUrl);
  }
  return { html: attempt.html, shouldEscalate: attempt.html === null };
}

/**
 * Launching a real browser on the Railway side occasionally fails
 * transiently (confirmed live 2026-07-26: a request got a 502, and the
 * exact same URL succeeded on immediate retry) — retry on any failure (5xx,
 * a malformed/unsuccessful response, or a network error), not just 5xx, with
 * a short backoff between attempts before giving up entirely.
 */
async function fetchViaBrowserBridge(hemnetUrl: string): Promise<string | null> {
  const apiBase = process.env.PYTHON_ENGINE_API_URL;
  if (!apiBase) {
    console.error(`[hemnetPage] PYTHON_ENGINE_API_URL not set — browser bridge unavailable, cannot escalate for ${hemnetUrl}`);
    return null;
  }

  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [800, 2000];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/browser-fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: hemnetUrl }),
        // Launching a real browser is much slower than a plain fetch.
        signal: AbortSignal.timeout(30000),
        cache: "no-store",
      });
      if (!res.ok) {
        console.error(`[hemnetPage] browser bridge returned status ${res.status} for ${hemnetUrl} (attempt ${attempt}/${MAX_ATTEMPTS})`);
        if (attempt < MAX_ATTEMPTS) {
          await delay(BACKOFF_MS[attempt - 1] ?? 2000);
          continue;
        }
        return null;
      }

      const body = (await res.json()) as { success?: boolean; html?: string };
      if (!body.success || typeof body.html !== "string") {
        console.error(`[hemnetPage] browser bridge returned success=false or no html for ${hemnetUrl} (attempt ${attempt}/${MAX_ATTEMPTS})`);
        if (attempt < MAX_ATTEMPTS) {
          await delay(BACKOFF_MS[attempt - 1] ?? 2000);
          continue;
        }
        return null;
      }
      return body.html;
    } catch (err) {
      console.error(`[hemnetPage] browser bridge network error for ${hemnetUrl} (attempt ${attempt}/${MAX_ATTEMPTS}):`, err);
      if (attempt >= MAX_ATTEMPTS) return null;
      await delay(BACKOFF_MS[attempt - 1] ?? 2000);
    }
  }
  return null;
}

export function parseHemnetHtml(html: string): HemnetPageData {
  const results: ExtractionResult[] = [
    { source: "apollo", data: extractApollo(html) },
    { source: "jsonld", data: extractJsonLd(html) },
    { source: "html", data: extractSemanticHtml(html) },
    { source: "regex", data: extractRegexFallback(html) },
  ];

  return mergeExtractions(results);
}
