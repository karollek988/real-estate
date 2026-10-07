// Standalone verification for the visitor counting (no test framework in this
// project - see helpers.verify.mjs). Run with:
//   npx tsx src/lib/analytics/analytics.verify.mjs
//
// Covers where a visitor came from (the channel and source, and the ka_src cookie), the device and bot classification, the anonymous daily visitor value, the
// Swedish calendar day, and the beacon endpoint itself: what it counts, what it
// refuses, and - by catching the outgoing database call - exactly what it sends.
import { classifyDevice, isBot } from "./device.ts";
import { stockholmDay } from "./day.ts";
import { getVisitorKey, visitorHash } from "./visitor.ts";
import { SOURCES, SOURCE_LABELS, classifySource, decodeSource, encodeSource, isKnownSource } from "./source.ts";
import { clearedSourceCookieText, readSourceCookie, sourceCookieText } from "./sourceCookie.ts";

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${ok ? "" : `\n    got      ${JSON.stringify(actual)}\n    expected ${JSON.stringify(expected)}`}`);
}

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  ipadAsMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  androidPhone: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  firefoxAndroid: "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0",
  windowsChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  linuxFirefox: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  headless: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36",
};

// ── devices ──────────────────────────────────────────────────────────────────
check("iPhone is mobile", classifyDevice(UA.iphone), "mobile");
check("Android phone is mobile", classifyDevice(UA.androidPhone), "mobile");
check("Firefox on Android is mobile", classifyDevice(UA.firefoxAndroid), "mobile");
check("iPad is a tablet", classifyDevice(UA.ipad), "tablet");
check("Android without 'Mobile' is a tablet", classifyDevice(UA.androidTablet), "tablet");
check("iPadOS posing as a Mac, with touch, is a tablet", classifyDevice(UA.ipadAsMac, null, true), "tablet");
check("a Mac without touch is a desktop", classifyDevice(UA.ipadAsMac, null, false), "desktop");
check("Windows Chrome is a desktop", classifyDevice(UA.windowsChrome), "desktop");
check("Linux Firefox is a desktop", classifyDevice(UA.linuxFirefox), "desktop");
check("the mobile client hint alone makes a phone", classifyDevice(UA.windowsChrome, "?1"), "mobile");
check("the mobile client hint does not turn a tablet into a phone", classifyDevice(UA.ipad, "?1"), "tablet");

// ── bots ─────────────────────────────────────────────────────────────────────
for (const [name, ua] of [["Googlebot", UA.googlebot], ["headless Chrome", UA.headless], ["curl", "curl/8.4.0"], ["python-requests", "python-requests/2.31"], ["empty user agent", ""], ["missing user agent", null]]) {
  check(`${name} is a bot`, isBot(ua), true);
}
for (const [name, ua] of [["iPhone", UA.iphone], ["Android phone", UA.androidPhone], ["Windows Chrome", UA.windowsChrome], ["Firefox", UA.linuxFirefox], ["an Android app (okhttp)", "okhttp/4.12.0 Mobile"]]) {
  check(`${name} is not a bot`, isBot(ua), false);
}

// ── the Swedish day ──────────────────────────────────────────────────────────
check("22:30 UTC on 5 Oct is already 6 Oct in Sweden (summer time)", stockholmDay(new Date("2026-10-05T22:30:00Z")), "2026-10-06");
check("21:30 UTC on 5 Oct is still 5 Oct", stockholmDay(new Date("2026-10-05T21:30:00Z")), "2026-10-05");
check("23:30 UTC on New Year's Eve is 1 Jan (winter time)", stockholmDay(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
check("midday is the same day", stockholmDay(new Date("2026-07-15T12:00:00Z")), "2026-07-15");

// ── the daily visitor value ──────────────────────────────────────────────────
const keyA = Buffer.alloc(32, 1);
const keyB = Buffer.alloc(32, 2);
const base = visitorHash(keyA, "2026-10-06", "203.0.113.7", UA.iphone);
check("32 hex characters", /^[0-9a-f]{32}$/.test(base), true);
check("the same visitor on the same day gives the same value", visitorHash(keyA, "2026-10-06", "203.0.113.7", UA.iphone), base);
check("the next day gives a different value (no following across days)", visitorHash(keyA, "2026-10-07", "203.0.113.7", UA.iphone) !== base, true);
check("another address gives a different value", visitorHash(keyA, "2026-10-06", "203.0.113.8", UA.iphone) !== base, true);
check("another browser gives a different value", visitorHash(keyA, "2026-10-06", "203.0.113.7", UA.windowsChrome) !== base, true);
check("another key gives a different value (the value alone does not identify anyone)", visitorHash(keyB, "2026-10-06", "203.0.113.7", UA.iphone) !== base, true);
check("the value contains neither the address nor the browser", base.includes("203") || base.toLowerCase().includes("iphone"), false);

const savedEnv = { s: process.env.SUPABASE_SERVICE_ROLE_KEY, a: process.env.ANALYTICS_HASH_SECRET };
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.ANALYTICS_HASH_SECRET;
check("without any secret a random in-memory key is used (32 bytes)", getVisitorKey().length, 32);
process.env.SUPABASE_SERVICE_ROLE_KEY = savedEnv.s ?? "";
if (savedEnv.a !== undefined) process.env.ANALYTICS_HASH_SECRET = savedEnv.a;

// ── the endpoint ─────────────────────────────────────────────────────────────
// Catch the database call that supabase-js makes, so we see exactly what would be stored.
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54399";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.includes("/rest/v1/rpc/record_page_view")) {
    sent.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(input, init);
};

const { POST } = await import("../../app/api/analytics/hit/route.ts");
const hit = (headers = {}, body = '{"t":0}') =>
  POST(new Request("http://localhost:3001/api/analytics/hit", { method: "POST", body, headers: { host: "localhost:3001", "user-agent": UA.iphone, "x-forwarded-for": "203.0.113.7", "sec-fetch-site": "same-origin", ...headers } }));

let response = await hit();
check("a normal page view answers 204", response.status, 204);
check("...and is counted once", sent.length, 1);
check("...with exactly three fields: the day, an anonymous value, the device type", Object.keys(sent[0]).sort(), ["p_day", "p_device", "p_visitor"]);
check("...the device is mobile", sent[0].p_device, "mobile");
check("...the day is a Swedish calendar day", /^\d{4}-\d{2}-\d{2}$/.test(sent[0].p_day), true);
check("...nothing sent contains the IP address or the user agent", JSON.stringify(sent[0]).includes("203.0.113.7") || JSON.stringify(sent[0]).includes("iPhone"), false);
const firstVisitor = sent[0].p_visitor;

await hit();
check("the same visitor sends the same anonymous value again", sent[1].p_visitor, firstVisitor);

await hit({ "user-agent": UA.ipad }, '{"t":1}');
check("a tablet is counted as a tablet", sent[2].p_device, "tablet");
await hit({ "user-agent": UA.ipadAsMac }, '{"t":1}');
check("an iPad that looks like a Mac is counted as a tablet via the touch hint", sent[3].p_device, "tablet");
await hit({ "user-agent": UA.windowsChrome }, "not json");
check("an unreadable body is tolerated: counted as a desktop", sent[4].p_device, "desktop");

const before = sent.length;
check("the admin host is refused with 404", (await hit({ host: "admin.kopanalys.se" })).status, 404);
check("a request from another site is ignored", (await hit({ "sec-fetch-site": "cross-site" })).status, 204);
await hit({ dnt: "1" });
await hit({ "sec-gpc": "1" });
await hit({ "user-agent": UA.googlebot });
await hit({ "user-agent": "" });
check("not counted: the admin host, another site, Do Not Track, Global Privacy Control, a bot, no user agent", sent.length, before);

// 120 a minute from one address is the limit; the rest of a flood is dropped
const flood = sent.length;
for (let i = 0; i < 130; i++) await hit({ "x-forwarded-for": "198.51.100.9" });
check("a flood from one address is cut off at 120 a minute", sent.length - flood, 120);

// ── where a visitor came from (source.ts) ────────────────────────────────────
const own = ["kopanalys.se"];
const from = (referrer, search = "", ownHosts = own) => classifySource({ referrer, search, ownHosts });
const label = (info) => `${info.channel}.${info.source}`;
const cases = [
  // search engines
  ["https://www.google.se/", "", "seo.google"],
  ["https://www.google.com/search?q=bostadsratt", "", "seo.google"],
  ["https://google.co.uk/", "", "seo.google"],
  ["https://WWW.GOOGLE.SE/", "", "seo.google"],
  ["https://www.bing.com/", "", "seo.bing"],
  ["https://duckduckgo.com/", "", "seo.duckduckgo"],
  ["https://search.yahoo.com/", "", "seo.yahoo"],
  ["https://www.ecosia.org/", "", "seo.ecosia"],
  ["https://search.brave.com/", "", "seo.brave"],
  ["https://yandex.ru/", "", "seo.yandex"],
  ["https://www.startpage.com/", "", "seo.other"],
  ["android-app://com.google.android.googlequicksearchbox/", "", "seo.google"],
  // AI search and chat: the Google-owned gemini host is AI, not search
  ["https://chatgpt.com/", "", "ai.chatgpt"],
  ["https://chat.openai.com/", "", "ai.chatgpt"],
  ["https://www.perplexity.ai/", "", "ai.perplexity"],
  ["https://gemini.google.com/", "", "ai.gemini"],
  ["https://copilot.microsoft.com/", "", "ai.copilot"],
  ["https://claude.ai/", "", "ai.claude"],
  ["https://you.com/", "", "ai.other"],
  ["android-app://com.openai.chatgpt/", "", "ai.chatgpt"],
  ["", "?utm_source=chatgpt.com", "ai.chatgpt"],
  ["", "utm_source=perplexity", "ai.perplexity"],
  // social
  ["https://l.facebook.com/l.php?u=x", "", "social.facebook"],
  ["https://m.facebook.com/", "", "social.facebook"],
  ["https://l.instagram.com/", "", "social.instagram"],
  ["https://t.co/abc", "", "social.x"],
  ["https://twitter.com/", "", "social.x"],
  ["https://x.com/", "", "social.x"],
  ["https://www.linkedin.com/feed/", "", "social.linkedin"],
  ["https://lnkd.in/x", "", "social.linkedin"],
  ["https://out.reddit.com/", "", "social.reddit"],
  ["https://www.tiktok.com/", "", "social.tiktok"],
  ["https://www.youtube.com/", "", "social.youtube"],
  ["https://www.pinterest.se/", "", "social.pinterest"],
  ["https://bsky.app/", "", "social.other"],
  ["android-app://com.instagram.android/", "", "social.instagram"],
  ["", "?utm_source=instagram", "social.instagram"],
  ["https://l.facebook.com/", "?fbclid=abc", "social.facebook"],
  // paid: a campaign tag or a click id wins over any referrer
  ["https://www.google.se/", "?utm_source=google&utm_medium=cpc", "ads.google"],
  ["https://www.google.se/", "?gclid=abc", "ads.google"],
  ["", "?gbraid=abc", "ads.google"],
  ["https://www.bing.com/", "?msclkid=1", "ads.bing"],
  ["", "?utm_source=facebook&utm_medium=paid_social", "ads.meta"],
  ["", "?utm_medium=cpc", "ads.other"],
  ["https://www.google.se/", "?utm_source=google&utm_medium=organic", "seo.google"],
  // everything else is direct
  ["", "", "direct.none"],
  ["not a url", "", "direct.none"],
  ["https://www.hemnet.se/", "", "direct.link"],
  ["https://mail.google.com/", "", "direct.link"],
  ["https://news.google.com/", "", "direct.link"],
  ["", "?utm_source=newsletter&utm_medium=email", "direct.other"],
  ["ios-app://389801252", "", "direct.none"],
  // the site itself is not a source; a look-alike host is not the real one
  ["https://kopanalys.se/priser", "", "direct.none"],
  ["https://www.kopanalys.se/", "", "direct.none"],
  ["https://notgoogle.com/", "", "direct.link"],
  ["https://google.evil.com/", "", "direct.link"],
  ["https://facebook.com.evil.com/", "", "direct.link"],
  ["https://notfacebook.com/", "", "direct.link"],
  ["https://chatgpt.com.evil.com/", "", "direct.link"],
];
for (const [referrer, search, expected] of cases) check(`${referrer || "(no referrer)"}${search ? ` ${search}` : ""} -> ${expected}`, label(from(referrer, search)), expected);
check("www.kopanalys.se as the site's own host also swallows kopanalys.se", label(from("https://kopanalys.se/", "", ["www.kopanalys.se"])), "direct.none");
check("localhost is its own source too, in development", label(from("http://localhost:3001/priser", "", ["localhost"])), "direct.none");
check("every answer is a channel and source the server will accept", cases.every(([r, s]) => isKnownSource(from(r, s).channel, from(r, s).source)), true);
check("every channel can say 'other'", Object.values(SOURCES).every((list) => list.includes("other")), true);
check("every source has a label", Object.values(SOURCES).flat().every((s) => typeof SOURCE_LABELS[s] === "string"), true);

// the cookie's value
check("a source round-trips through the cookie value", decodeSource(encodeSource({ channel: "ai", source: "chatgpt" })), { channel: "ai", source: "chatgpt" });
check("a cookie value that is not channel.source from the lists is refused", ["seo.hacker", "x.y", "seo", "seo.google.extra", "", "seo.", ".google", "ai.google"].map(decodeSource), [null, null, null, null, null, null, null, null]);

// the cookie itself
check("the cookie is found among others", readSourceCookie("a=1; ka_src=seo.google; b=2"), { channel: "seo", source: "google" });
check("no cookie, or an invalid one, reads as none", [readSourceCookie(""), readSourceCookie("a=1"), readSourceCookie("ka_src=junk"), readSourceCookie("ka_srcx=seo.google")], [null, null, null, null]);
check("the cookie is first-party, 90 days, and Secure on https only", [sourceCookieText({ channel: "seo", source: "google" }, true), sourceCookieText({ channel: "seo", source: "google" }, false)], ["ka_src=seo.google; Max-Age=7776000; Path=/; SameSite=Lax; Secure", "ka_src=seo.google; Max-Age=7776000; Path=/; SameSite=Lax"]);
check("it is removed with Max-Age=0", clearedSourceCookieText(true), "ka_src=; Max-Age=0; Path=/; SameSite=Lax; Secure");
check("the cookie holds nothing but the two words (no id, no number)", /^ka_src=[a-z]+\.[a-z_]+;/.test(sourceCookieText({ channel: "social", source: "linkedin" }, false)), true);

// ── the arrival endpoint ─────────────────────────────────────────────────────
const acquisitions = [];
const previousFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.includes("/rest/v1/rpc/record_acquisition")) {
    acquisitions.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return previousFetch(input, init);
};
const { POST: arrival } = await import("../../app/api/analytics/arrival/route.ts");
const arrive = (body, headers = {}) =>
  arrival(new Request("http://localhost:3001/api/analytics/arrival", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { host: "localhost:3001", "user-agent": UA.iphone, "x-forwarded-for": "203.0.113.50", "sec-fetch-site": "same-origin", ...headers } }));

check("accepting answers 204", (await arrive({ e: "accept", c: "seo", s: "google" })).status, 204);
check("...and is recorded once, with exactly four fields: day, event, channel, source", [acquisitions.length, Object.keys(acquisitions[0]).sort()], [1, ["p_channel", "p_day", "p_event", "p_source"]]);
check("...as an accept from seo/google, on a Swedish day", [acquisitions[0].p_event, acquisitions[0].p_channel, acquisitions[0].p_source, /^\d{4}-\d{2}-\d{2}$/.test(acquisitions[0].p_day)], ["accept", "seo", "google", true]);
check("...with nothing about the visitor in it", JSON.stringify(acquisitions[0]).includes("203.0.113.50") || JSON.stringify(acquisitions[0]).includes("iPhone"), false);

await arrive({ e: "arrive", c: "ai", s: "chatgpt" });
check("a returning visitor whose cookie has expired is recorded as an arrival", [acquisitions[1].p_event, acquisitions[1].p_channel, acquisitions[1].p_source], ["arrive", "ai", "chatgpt"]);

await arrive({ e: "decline", c: "seo", s: "google" });
check("a decline carries no channel and no source, even if the body has them", [acquisitions[2].p_event, acquisitions[2].p_channel, acquisitions[2].p_source], ["decline", null, null]);

await arrive({ e: "accept", c: "seo", s: "chatgpt" });
await arrive({ e: "accept", c: "direct", s: "<script>" });
await arrive({ e: "accept", c: "social" });
check("a source that is not one of the channel's own becomes 'other'", acquisitions.slice(3).map((a) => [a.p_channel, a.p_source]), [["seo", "other"], ["direct", "other"], ["social", "other"]]);

const countBefore = acquisitions.length;
for (const body of [{ e: "accept", c: "email", s: "x" }, { e: "accept", c: "seo'); drop table analytics_daily; --" }, { e: "accept" }, { e: "purchase", c: "seo" }, { c: "seo" }, "not json", "null", "[]", "42", "x".repeat(5000)]) await arrive(body);
check("an unknown channel, an unknown event, a missing channel or unreadable text records nothing", acquisitions.length, countBefore);

const count2 = acquisitions.length;
check("the admin host is refused with 404", (await arrive({ e: "accept", c: "seo", s: "google" }, { host: "admin.kopanalys.se" })).status, 404);
check("a request from another site is ignored", (await arrive({ e: "accept", c: "seo", s: "google" }, { "sec-fetch-site": "cross-site" })).status, 204);
await arrive({ e: "accept", c: "seo", s: "google" }, { dnt: "1" });
await arrive({ e: "decline" }, { "sec-gpc": "1" });
await arrive({ e: "accept", c: "seo", s: "google" }, { "user-agent": UA.googlebot });
await arrive({ e: "accept", c: "seo", s: "google" }, { "user-agent": "" });
check("not recorded: the admin host, another site, Do Not Track, Global Privacy Control, a bot, no user agent", acquisitions.length, count2);

const flood2 = acquisitions.length;
for (let i = 0; i < 40; i++) await arrive({ e: "decline" }, { "x-forwarded-for": "198.51.100.77" });
check("a flood from one address is cut off at 30 a minute", acquisitions.length - flood2, 30);
globalThis.fetch = previousFetch;

globalThis.fetch = realFetch;
console.log(failures === 0 ? "\nAll analytics checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
