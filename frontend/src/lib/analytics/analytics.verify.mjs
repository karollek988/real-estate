// Standalone verification for the visitor counting (no test framework in this
// project - see helpers.verify.mjs). Run with:
//   npx tsx src/lib/analytics/analytics.verify.mjs
//
// Covers the device and bot classification, the anonymous daily visitor value, the
// Swedish calendar day, and the beacon endpoint itself: what it counts, what it
// refuses, and - by catching the outgoing database call - exactly what it sends.
import { classifyDevice, isBot } from "./device.ts";
import { stockholmDay } from "./day.ts";
import { getVisitorKey, visitorHash } from "./visitor.ts";

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

globalThis.fetch = realFetch;
console.log(failures === 0 ? "\nAll analytics checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
