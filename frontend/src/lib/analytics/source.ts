/**
 * Where a new visitor came from, as one of the acquisition model's five channels.
 *
 * Runs in the visitor's browser (SourceTracker) and in tests: the raw referrer and address never leave
 * the device, only the answer does - a channel and one source name from the short fixed lists below.
 *
 *   seo      search engines (Google, Bing, DuckDuckGo ...)
 *   ai       AI search and chat (ChatGPT, Perplexity, Gemini, Copilot, Claude ...)
 *   social   social media (Facebook, Instagram, LinkedIn, X, Reddit, TikTok ...)
 *   ads      paid: a paid campaign tag (utm_medium=cpc and similar) or an ad click id (gclid, msclkid)
 *   direct   everything else: typed address and bookmarks, links from other sites, newsletters
 *
 * The order of the checks is the order of trust: a paid tag wins over everything, a named campaign
 * source (utm_source) wins over the referrer, and what is left is judged by the referrer's host. ChatGPT
 * adds utm_source=chatgpt.com to the links it shows, which is how its visitors are found even though the
 * browser sends no referrer from there.
 */
import type { ChannelId } from "@/lib/markov/acquisition";

/** The source names a channel can have, and nothing else is ever sent or stored. "other" is always among them. */
export const SOURCES: Record<ChannelId, readonly string[]> = {
  seo: ["google", "bing", "duckduckgo", "ecosia", "yahoo", "brave", "yandex", "other"],
  ads: ["google", "bing", "meta", "other"],
  social: ["facebook", "instagram", "linkedin", "x", "reddit", "tiktok", "youtube", "pinterest", "other"],
  ai: ["chatgpt", "perplexity", "gemini", "copilot", "claude", "other"],
  // none: no referrer at all; link: another website; other: a campaign tag that is not a known source (a newsletter)
  direct: ["none", "link", "other"],
};

export const SOURCE_LABELS: Record<string, string> = {
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  ecosia: "Ecosia",
  yahoo: "Yahoo",
  brave: "Brave Search",
  yandex: "Yandex",
  meta: "Meta (Facebook, Instagram)",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  reddit: "Reddit",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  gemini: "Gemini",
  copilot: "Copilot",
  claude: "Claude",
  none: "Ingen avsändare",
  link: "Länk från annan sida",
  other: "Övrigt",
};

export interface SourceInfo {
  channel: ChannelId;
  source: string;
}

export const isKnownSource = (channel: string, source: string): boolean => (SOURCES as Record<string, readonly string[] | undefined>)[channel]?.includes(source) ?? false;

export interface ClassifyInput {
  /** document.referrer ("" when there is none) */
  referrer: string;
  /** location.search, with or without the leading "?" */
  search: string;
  /** this site's own host names: a referrer from one of them is the site itself, not a source */
  ownHosts: readonly string[];
}

const PAID_MEDIUMS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid-search", "paid_search", "paidsocial", "paid-social", "paid_social", "display", "cpm", "banner", "ads", "ad", "sem", "retargeting", "remarketing"]);

const normalizeHost = (host: string) => host.toLowerCase().replace(/\.$/, "").replace(/^(www|m|l|lm|mobile)\./, "");
const inDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

// ── what a campaign tag or a host name says ─────────────────────────────────

/** utm_source values that name a source on their own. */
function fromCampaignName(raw: string): SourceInfo | null {
  const name = raw.toLowerCase().trim().replace(/^www\./, "");
  const table: [RegExp, SourceInfo][] = [
    [/^(chatgpt(\.com)?|openai)$/, { channel: "ai", source: "chatgpt" }],
    [/^perplexity(\.ai)?$/, { channel: "ai", source: "perplexity" }],
    [/^(gemini|bard)(\.google\.com)?$/, { channel: "ai", source: "gemini" }],
    [/^copilot(\.microsoft\.com)?$/, { channel: "ai", source: "copilot" }],
    [/^claude(\.ai)?$/, { channel: "ai", source: "claude" }],
    [/^(grok|deepseek|poe|phind|you\.com|meta\.ai|mistral)$/, { channel: "ai", source: "other" }],
    [/^(facebook|fb|facebook\.com)$/, { channel: "social", source: "facebook" }],
    [/^(instagram|ig|instagram\.com)$/, { channel: "social", source: "instagram" }],
    [/^(linkedin|linkedin\.com|lnkd\.in)$/, { channel: "social", source: "linkedin" }],
    [/^(twitter|x|x\.com|twitter\.com|t\.co)$/, { channel: "social", source: "x" }],
    [/^(reddit|reddit\.com)$/, { channel: "social", source: "reddit" }],
    [/^(tiktok|tiktok\.com)$/, { channel: "social", source: "tiktok" }],
    [/^(youtube|youtube\.com|youtu\.be)$/, { channel: "social", source: "youtube" }],
    [/^(pinterest|pinterest\.com)$/, { channel: "social", source: "pinterest" }],
    [/^(threads|snapchat|bluesky|bsky|tumblr|discord)$/, { channel: "social", source: "other" }],
    [/^(google|google\.com)$/, { channel: "seo", source: "google" }],
    [/^(bing|bing\.com)$/, { channel: "seo", source: "bing" }],
    [/^(duckduckgo|duckduckgo\.com)$/, { channel: "seo", source: "duckduckgo" }],
    [/^(ecosia|ecosia\.org)$/, { channel: "seo", source: "ecosia" }],
    [/^yahoo$/, { channel: "seo", source: "yahoo" }],
    [/^brave$/, { channel: "seo", source: "brave" }],
  ];
  return table.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

/** The paid source an ad click names: by campaign source, falling back on which ad network's click id it carries. */
function paidSource(name: string, params: URLSearchParams): string {
  const n = name.toLowerCase();
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid") || params.has("dclid") || /^google/.test(n)) return "google";
  if (params.has("msclkid") || /^(bing|microsoft)/.test(n)) return "bing";
  if (/^(facebook|fb|instagram|ig|meta)/.test(n)) return "meta";
  return "other";
}

function fromAppPackage(pkg: string): SourceInfo | null {
  const id = pkg.toLowerCase();
  if (id.includes("chatgpt")) return { channel: "ai", source: "chatgpt" };
  if (id.includes("perplexity")) return { channel: "ai", source: "perplexity" };
  if (id.includes("bard") || id.includes("gemini")) return { channel: "ai", source: "gemini" };
  if (id.includes("copilot")) return { channel: "ai", source: "copilot" };
  if (id.includes("anthropic") || id.includes("claude")) return { channel: "ai", source: "claude" };
  if (id.includes("googlequicksearchbox")) return { channel: "seo", source: "google" };
  if (id.includes("facebook")) return { channel: "social", source: "facebook" };
  if (id.includes("instagram")) return { channel: "social", source: "instagram" };
  if (id.includes("linkedin")) return { channel: "social", source: "linkedin" };
  if (id.includes("twitter")) return { channel: "social", source: "x" };
  if (id.includes("reddit")) return { channel: "social", source: "reddit" };
  if (id.includes("musically") || id.includes("tiktok")) return { channel: "social", source: "tiktok" };
  if (id.includes("youtube")) return { channel: "social", source: "youtube" };
  if (id.includes("pinterest")) return { channel: "social", source: "pinterest" };
  return null;
}

function fromHost(host: string): SourceInfo {
  // AI first: gemini.google.com is a Google host but not a search
  if (inDomain(host, "chatgpt.com") || host === "chat.openai.com") return { channel: "ai", source: "chatgpt" };
  if (inDomain(host, "perplexity.ai")) return { channel: "ai", source: "perplexity" };
  if (host === "gemini.google.com" || host === "bard.google.com") return { channel: "ai", source: "gemini" };
  if (host === "copilot.microsoft.com" || inDomain(host, "copilot.cloud.microsoft")) return { channel: "ai", source: "copilot" };
  if (inDomain(host, "claude.ai")) return { channel: "ai", source: "claude" };
  if (["you.com", "phind.com", "poe.com", "grok.com", "deepseek.com", "meta.ai", "mistral.ai", "duck.ai"].some((d) => inDomain(host, d))) return { channel: "ai", source: "other" };

  // search engines
  if (/^google\.([a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(host)) return { channel: "seo", source: "google" };
  if (inDomain(host, "bing.com")) return { channel: "seo", source: "bing" };
  if (inDomain(host, "duckduckgo.com")) return { channel: "seo", source: "duckduckgo" };
  if (inDomain(host, "ecosia.org")) return { channel: "seo", source: "ecosia" };
  if (/(^|\.)yahoo\.[a-z.]{2,}$/.test(host)) return { channel: "seo", source: "yahoo" };
  if (host === "search.brave.com") return { channel: "seo", source: "brave" };
  if (/(^|\.)yandex\.[a-z.]{2,}$/.test(host)) return { channel: "seo", source: "yandex" };
  if (["startpage.com", "qwant.com", "baidu.com", "kagi.com", "seznam.cz", "naver.com"].some((d) => inDomain(host, d))) return { channel: "seo", source: "other" };

  // social media
  if (inDomain(host, "facebook.com") || inDomain(host, "fb.com") || host === "fb.me") return { channel: "social", source: "facebook" };
  if (inDomain(host, "instagram.com")) return { channel: "social", source: "instagram" };
  if (inDomain(host, "linkedin.com") || host === "lnkd.in") return { channel: "social", source: "linkedin" };
  if (host === "t.co" || inDomain(host, "twitter.com") || inDomain(host, "x.com")) return { channel: "social", source: "x" };
  if (inDomain(host, "reddit.com") || host === "redd.it") return { channel: "social", source: "reddit" };
  if (inDomain(host, "tiktok.com")) return { channel: "social", source: "tiktok" };
  if (inDomain(host, "youtube.com") || host === "youtu.be") return { channel: "social", source: "youtube" };
  if (/(^|\.)pinterest\.[a-z.]{2,}$/.test(host) || host === "pin.it") return { channel: "social", source: "pinterest" };
  if (["threads.net", "snapchat.com", "bsky.app", "tumblr.com", "discord.com", "vk.com"].some((d) => inDomain(host, d))) return { channel: "social", source: "other" };

  return { channel: "direct", source: "link" };
}

// ── the answer ───────────────────────────────────────────────────────────────

export function classifySource({ referrer, search, ownHosts }: ClassifyInput): SourceInfo {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const campaignSource = (params.get("utm_source") ?? "").trim();
  const medium = (params.get("utm_medium") ?? "").trim().toLowerCase();

  // 1. paid: a campaign tag that says so, or the click id an ad network adds
  if (PAID_MEDIUMS.has(medium) || params.has("gclid") || params.has("gbraid") || params.has("wbraid") || params.has("dclid") || params.has("msclkid")) {
    return { channel: "ads", source: paidSource(campaignSource, params) };
  }

  // 2. a named campaign source
  if (campaignSource) return fromCampaignName(campaignSource) ?? { channel: "direct", source: "other" };

  // 3. the referrer
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return { channel: "direct", source: "none" };
  }
  if (url.protocol === "android-app:") return fromAppPackage(url.hostname) ?? { channel: "direct", source: "link" };
  if (url.protocol !== "http:" && url.protocol !== "https:") return { channel: "direct", source: "none" };

  const host = normalizeHost(url.hostname);
  if (ownHosts.some((own) => inDomain(host, normalizeHost(own)))) return { channel: "direct", source: "none" };
  return fromHost(host);
}

// ── the cookie's value ───────────────────────────────────────────────────────

/** "seo.google": the channel and source of the first visit. Nothing else is in the cookie. */
export const encodeSource = (info: SourceInfo): string => `${info.channel}.${info.source}`;

export function decodeSource(value: string): SourceInfo | null {
  const [channel, source, ...rest] = value.split(".");
  if (rest.length > 0 || !channel || !source || !isKnownSource(channel, source)) return null;
  return { channel: channel as ChannelId, source };
}
