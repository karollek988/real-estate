/**
 * Classify a pasted URL before extraction, mirroring the decision tree in
 * docs/22_user_input_flow.md §2. Hemnet is URL-parseable (address lives in
 * the slug). Booli listing URLs are just an opaque numeric id — no address
 * is encoded in the URL itself (confirmed against real booli.se/annons/{id}
 * and booli.se/bostad/{id} links) — so a bare Booli link is recognized but
 * still needs the address from the user; the Booli enrichment provider
 * (`providers/booli.ts`) then runs automatically against that address once
 * BOOLI_API_KEY is configured. Other known providers are recognized so the
 * user gets an honest "not supported yet" message instead of a generic
 * failure.
 */

const BOOLI_LISTING_PATH = /^\/(annons|bostad)\/(\d+)/;

const KNOWN_PROVIDERS: Record<string, string> = {
  "boneo.se": "Boneo",
  "fastighetsbyran.com": "Fastighetsbyrån",
  "fastighetsbyran.se": "Fastighetsbyrån",
  "bjurfors.se": "Bjurfors",
  "husmanhagberg.se": "HusmanHagberg",
  "svenskfast.se": "Svensk Fastighetsförmedling",
  "notar.se": "Notar",
};

export type ListingUrlClassification =
  | { kind: "hemnet"; url: string }
  | { kind: "booli"; listingId: string }
  | { kind: "unsupported_provider"; provider: string }
  | { kind: "unknown_url"; host: string }
  | { kind: "invalid_url" };

export function classifyListingUrl(rawUrl: string): ListingUrlClassification {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { kind: "invalid_url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { kind: "invalid_url" };
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "hemnet.se") {
    return { kind: "hemnet", url: rawUrl.trim() };
  }
  if (host === "booli.se") {
    const match = url.pathname.match(BOOLI_LISTING_PATH);
    if (match) {
      return { kind: "booli", listingId: match[2] };
    }
    return { kind: "unsupported_provider", provider: "Booli" };
  }
  if (KNOWN_PROVIDERS[host]) {
    return { kind: "unsupported_provider", provider: KNOWN_PROVIDERS[host] };
  }
  return { kind: "unknown_url", host };
}
