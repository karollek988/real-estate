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
 * Fetch a Hemnet listing page and extract all available property data.
 *
 * Tries a direct fetch first (fast, no dependency). If Cloudflare blocks it
 * or the request fails at the network level, escalates to the Python
 * engine's Camoufox (real Firefox) browser-fetch bridge — POST
 * /api/browser-fetch (api/server.py), a thin wrapper around the same
 * `_browser_fetch()` already used by the BRF acquisition pipeline. This
 * reuses that existing anti-detection mechanism instead of adding a second
 * browser stack to the TypeScript side. Returns null only when both the
 * direct fetch and the browser bridge fail (or the bridge isn't configured
 * — no PYTHON_ENGINE_API_URL — in which case only the direct fetch ever ran).
 */
export async function scrapeHemnetPage(hemnetUrl: string): Promise<HemnetPageData | null> {
  const direct = await fetchDirect(hemnetUrl);
  if (direct.html !== null) {
    console.log(`[hemnetPage] direct fetch OK for ${hemnetUrl}`);
    return parseHemnetHtml(direct.html);
  }
  if (!direct.shouldEscalate) {
    console.error(`[hemnetPage] direct fetch failed (non-blocked status), no escalation configured for ${hemnetUrl}`);
    return null;
  }

  console.warn(`[hemnetPage] direct fetch blocked, escalating to browser bridge for ${hemnetUrl}`);
  const viaBrowser = await fetchViaBrowserBridge(hemnetUrl);
  if (viaBrowser !== null) {
    console.log(`[hemnetPage] browser bridge OK for ${hemnetUrl}`);
    return parseHemnetHtml(viaBrowser);
  }
  console.error(`[hemnetPage] browser bridge also failed for ${hemnetUrl}`);
  return null;
}

async function fetchDirect(hemnetUrl: string): Promise<{ html: string | null; shouldEscalate: boolean }> {
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
    if (res.ok) return { html: await res.text(), shouldEscalate: false };
    const blocked = BOT_BLOCKED_STATUSES.has(res.status);
    if (blocked) {
      console.warn(`[hemnetPage] fetchDirect blocked with status ${res.status} for ${hemnetUrl}`);
    } else {
      console.error(`[hemnetPage] fetchDirect returned status ${res.status} for ${hemnetUrl}`);
    }
    return { html: null, shouldEscalate: blocked };
  } catch (err) {
    console.error(`[hemnetPage] fetchDirect network error for ${hemnetUrl}:`, err);
    return { html: null, shouldEscalate: true };
  }
}

/**
 * Launching a real browser on the Railway side occasionally fails
 * transiently (confirmed live 2026-07-26: a request got a 502, and the
 * exact same URL succeeded on immediate retry) — one retry on a 5xx or
 * network error is worth the extra time before giving up entirely.
 */
async function fetchViaBrowserBridge(hemnetUrl: string): Promise<string | null> {
  const apiBase = process.env.PYTHON_ENGINE_API_URL;
  if (!apiBase) {
    console.error(`[hemnetPage] PYTHON_ENGINE_API_URL not set — browser bridge unavailable, cannot escalate for ${hemnetUrl}`);
    return null;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
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
        console.error(`[hemnetPage] browser bridge returned status ${res.status} for ${hemnetUrl} (attempt ${attempt})`);
        if (res.status >= 500 && attempt < 2) continue;
        return null;
      }

      const body = (await res.json()) as { success?: boolean; html?: string };
      if (!body.success || typeof body.html !== "string") {
        console.error(`[hemnetPage] browser bridge returned success=false or no html for ${hemnetUrl} (attempt ${attempt})`);
        return null;
      }
      return body.html;
    } catch (err) {
      console.error(`[hemnetPage] browser bridge network error for ${hemnetUrl} (attempt ${attempt}):`, err);
      if (attempt >= 2) return null;
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
