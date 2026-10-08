// Standalone verification for the admin statistics (no test framework in this
// project - see helpers.verify.mjs). Run with:
//   npx tsx src/lib/admin/stats.verify.mjs
import { niceRange, niceScale } from "../../components/admin/stats/charts.tsx";
import {
  HISTORY_DAYS,
  PACKAGES,
  addDays,
  buildDays,
  change,
  formatDecimal,
  formatInt,
  formatPercent,
  packageKeyOf,
  shortDate,
  summarize,
  windowOf,
} from "./stats.ts";
import { loadAdminStats } from "./statsData.ts";
import { buildDemoStats } from "./statsDemo.ts";

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${ok ? "" : `\n    got      ${JSON.stringify(actual)}\n    expected ${JSON.stringify(expected)}`}`);
}

// ── dates and formatting ─────────────────────────────────────────────────────
check("addDays over a month end", addDays("2026-10-31", 1), "2026-11-01");
check("addDays over a year end, backwards", addDays("2027-01-01", -1), "2026-12-31");
check("addDays over the spring clock change does not skip or repeat a day", [addDays("2026-03-28", 1), addDays("2026-03-28", 2), addDays("2026-03-28", 3)], ["2026-03-29", "2026-03-30", "2026-03-31"]);
check("addDays over the autumn clock change", [addDays("2026-10-24", 1), addDays("2026-10-24", 2)], ["2026-10-25", "2026-10-26"]);
check("shortDate", [shortDate("2026-10-06"), shortDate("2026-01-31"), shortDate("2026-05-01")], ["6 okt", "31 jan", "1 maj"]);
check("formatInt groups thousands with a no-break space", formatInt(1234567), "1 234 567");
check("formatPercent", formatPercent(0.4567), "46 %");
check("formatDecimal uses a comma", formatDecimal(2.25), "2,3");

// ── packages ─────────────────────────────────────────────────────────────────
check("the three packages keep their keys", ["omradesanalys", "trygghetspaket", "tre_bostader"].map(packageKeyOf), ["omradesanalys", "trygghetspaket", "tre_bostader"]);
check("an older or unknown price key is 'other'", [packageKeyOf("premium_analysis"), packageKeyOf("whatever"), packageKeyOf("")], ["other", "other", "other"]);
check("package prices come from lib/pricing", [PACKAGES.omradesanalys.priceSek, PACKAGES.trygghetspaket.priceSek, PACKAGES.tre_bostader.priceSek, PACKAGES.other.priceSek], [99, 499, 999, null]);

// ── building days ────────────────────────────────────────────────────────────
const TODAY = "2026-10-06";
const days = buildDays(
  [
    { day: "2026-10-06", device: "mobile", visitors: 10, page_views: 25 },
    { day: "2026-10-06", device: "desktop", visitors: 4, page_views: 15 },
    { day: "2026-10-05", device: "tablet", visitors: 2, page_views: 3 },
    { day: "2026-10-06", device: "watch", visitors: 99, page_views: 99 }, // unknown device: ignored
    { day: "2020-01-01", device: "mobile", visitors: 99, page_views: 99 }, // outside the window: ignored
  ],
  [
    { price_key: "trygghetspaket", created_at: "2026-10-05T22:30:00Z" }, // 00:30 on the 6th in Sweden
    { price_key: "trygghetspaket", created_at: "2026-10-06T08:00:00Z" },
    { price_key: "omradesanalys", created_at: "2026-10-05T21:30:00Z" }, // 23:30 on the 5th
    { price_key: "premium_analysis", created_at: "2026-10-05T10:00:00Z" },
    { price_key: "tre_bostader", created_at: "not a date" }, // ignored
    { price_key: "tre_bostader", created_at: "2019-01-01T00:00:00Z" }, // outside the window: ignored
  ],
  TODAY
);
const byDay = Object.fromEntries(days.map((d) => [d.day, d]));
check("HISTORY_DAYS days, oldest first, ending today", [days.length, days[0].day, days[days.length - 1].day], [HISTORY_DAYS, addDays(TODAY, -(HISTORY_DAYS - 1)), TODAY]);
check("every day is there, in order, once", days.every((d, i) => i === 0 || d.day === addDays(days[i - 1].day, 1)), true);
check("a day with nothing in it is all zeros", byDay["2026-09-20"], { day: "2026-09-20", visitors: { mobile: 0, tablet: 0, desktop: 0 }, pageViews: { mobile: 0, tablet: 0, desktop: 0 }, purchases: { omradesanalys: 0, trygghetspaket: 0, tre_bostader: 0, other: 0 } });
check("visitors and page views land on their day and device", [byDay[TODAY].visitors, byDay[TODAY].pageViews], [{ mobile: 10, tablet: 0, desktop: 4 }, { mobile: 25, tablet: 0, desktop: 15 }]);
check("an unknown device and an out-of-window day are ignored", [byDay[TODAY].visitors.mobile, days.some((d) => d.day === "2020-01-01")], [10, false]);
check("a purchase at 00:30 Swedish time belongs to the new day, not the UTC day", [byDay["2026-10-06"].purchases.trygghetspaket, byDay["2026-10-05"].purchases.trygghetspaket], [2, 0]);
check("a purchase at 23:30 Swedish time stays on its day", byDay["2026-10-05"].purchases.omradesanalys, 1);
check("an older price key is counted under 'other'", byDay["2026-10-05"].purchases.other, 1);
check("an unreadable or out-of-window date is dropped", [days.reduce((n, d) => n + d.purchases.tre_bostader, 0)], [0]);

// ── summing ──────────────────────────────────────────────────────────────────
const week = summarize(windowOf(days, 7));
check("7 days summed: visitors, page views", [week.visitors, week.pageViews], [16, 43]);
check("visitors by device", week.visitorsByDevice, { mobile: 10, tablet: 2, desktop: 4 });
check("purchases per package", [week.byPackage.omradesanalys.count, week.byPackage.trygghetspaket.count, week.byPackage.other.count, week.purchases], [1, 2, 1, 4]);
check("revenue = count x list price; 'other' has no price", [week.byPackage.omradesanalys.revenueSek, week.byPackage.trygghetspaket.revenueSek, week.byPackage.other.revenueSek, week.revenueSek], [99, 998, 0, 1097]);
check("purchases per 100 visitors", week.purchasesPer100Visitors, (4 / 16) * 100);
check("with no visitors there is no conversion figure (not a division by zero)", summarize(windowOf(days, 7, 7)).purchasesPer100Visitors, null);
check("an empty window sums to zeros", summarize([]).visitors, 0);

// ── windows and change ───────────────────────────────────────────────────────
check("windowOf takes the last days", windowOf(days, 3).map((d) => d.day), ["2026-10-04", "2026-10-05", "2026-10-06"]);
check("windowOf with an offset takes the same length just before", windowOf(days, 3, 3).map((d) => d.day), ["2026-10-01", "2026-10-02", "2026-10-03"]);
check("the 90-day window and the 90 before it both fit in the history", [windowOf(days, 90).length, windowOf(days, 90, 90).length], [90, 90]);
check("change: up 50 %", change(15, 10), 0.5);
check("change: down 20 %", change(8, 10), -0.2);
check("change from nothing is not a number", change(5, 0), null);

// ── the chart scale ──────────────────────────────────────────────────────────
check("scale for nothing is a small empty axis", niceScale(0, true), { min: 0, max: 4, step: 1 });
check("scale for 7 whole things", niceScale(7, true), { min: 0, max: 8, step: 2 });
check("scale for 230", niceScale(230, true), { min: 0, max: 300, step: 100 });
check("a count of 1 keeps whole steps", niceScale(1, true), { min: 0, max: 1, step: 1 });
check("the scale always reaches the data", [3, 17, 41, 99, 100, 101, 987, 12345].every((v) => niceScale(v, true).max >= v), true);
check("a scale that goes below zero keeps zero among its ticks, and reaches both ends of the data", [[-300, 700], [-5, 40], [-1200, 0], [-0.5, 3]].every(([lo, hi]) => { const s = niceRange(lo, hi); const ticks = []; for (let v = s.min; v <= s.max + 1e-9; v += s.step) ticks.push(Math.round(v * 1000) / 1000); return s.min <= lo && s.max >= hi && ticks.includes(0); }), true);
check("with nothing below zero, niceRange is niceScale", JSON.stringify(niceRange(0, 230, true)), JSON.stringify(niceScale(230, true)));

// ── demo data and the loader's safety switches ───────────────────────────────
const demoA = buildDemoStats(TODAY, "2026-10-06T10:00:00Z");
const demoB = buildDemoStats(TODAY, "2026-10-06T10:00:00Z");
check("demo data is deterministic", demoA, demoB);
check("demo data fills the history and says it is demo", [demoA.days.length, demoA.demo, demoA.days[demoA.days.length - 1].day], [HISTORY_DAYS, true, TODAY]);
const demoTotals = summarize(demoA.days);
check("demo data has all the three devices and all the three packages in it", [demoTotals.visitorsByDevice.mobile > 0, demoTotals.visitorsByDevice.tablet > 0, demoTotals.visitorsByDevice.desktop > 0, demoTotals.byPackage.omradesanalys.count > 0, demoTotals.byPackage.trygghetspaket.count > 0, demoTotals.byPackage.tre_bostader.count > 0], [true, true, true, true, true, true]);

const env = { ...process.env };
const restore = () => { for (const k of ["NODE_ENV", "ADMIN_STATS_DEMO", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; } };
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.ADMIN_STATS_DEMO;
process.env.NODE_ENV = "development";
check("no database settings: 'unconfigured', not a crash", (await loadAdminStats(new Date("2026-10-06T10:00:00Z"))).status, "unconfigured");
process.env.ADMIN_STATS_DEMO = "1";
const demoResult = await loadAdminStats(new Date("2026-10-06T10:00:00Z"));
check("ADMIN_STATS_DEMO=1 in development gives demo data", [demoResult.status, demoResult.stats?.demo], ["ok", true]);
process.env.NODE_ENV = "production";
check("ADMIN_STATS_DEMO=1 does nothing in production", (await loadAdminStats(new Date("2026-10-06T10:00:00Z"))).status, "unconfigured");
restore();

// ── the loader against a stand-in for the database's REST API ────────────────
// The real supabase-js client, pointed at a local server that answers like PostgREST, so the
// queries it sends and the way it reads the answers are exercised for real.
const { createServer } = await import("node:http");
const NOW = new Date("2026-10-06T10:00:00Z");
const requests = [];
let mode = "ok";
const purchaseRows = Array.from({ length: 1003 }, (_, i) => ({
  price_key: ["omradesanalys", "trygghetspaket", "tre_bostader"][i % 3],
  created_at: new Date(Date.parse("2026-09-01T12:00:00Z") + i * 60_000).toISOString(),
}));
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://stub");
  requests.push(url);
  const send = (status, body) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (mode === "missing" && url.pathname.endsWith("/analytics_daily")) return send(404, { code: "PGRST205", message: "Could not find the table 'public.analytics_daily' in the schema cache" });
  if (mode === "broken") return send(500, { message: "the database is on fire" });
  if (url.pathname.endsWith("/analytics_daily")) {
    if (url.searchParams.get("select") === "day") return send(200, [{ day: "2026-09-02" }]);
    return send(200, [
      { day: "2026-10-06", device: "mobile", visitors: 7, page_views: 20 },
      { day: "2026-10-06", device: "desktop", visitors: 3, page_views: 12 },
    ]);
  }
  if (url.pathname.endsWith("/credit_purchases")) {
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 1000);
    return send(200, purchaseRows.slice(offset, offset + limit));
  }
  return send(404, { message: "unexpected" });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
process.env.NODE_ENV = "development";
delete process.env.ADMIN_STATS_DEMO;
process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
process.env.SUPABASE_SERVICE_ROLE_KEY = "x".repeat(40);

let result = await loadAdminStats(NOW);
check("a healthy database: status ok, not demo", [result.status, result.stats?.demo], ["ok", false]);
const stats = result.stats;
check("the first tracked day is the earliest row in the table, not just in the window", stats.trackingSince, "2026-09-02");
check("visitors and page views come from analytics_daily", [stats.days.at(-1).visitors, stats.days.at(-1).pageViews], [{ mobile: 7, tablet: 0, desktop: 3 }, { mobile: 20, tablet: 0, desktop: 12 }]);
const totalPurchases = stats.days.reduce((n, d) => n + Object.values(d.purchases).reduce((a, b) => a + b, 0), 0);
check("all 1003 purchases are read although the database answers 1000 at a time", totalPurchases, 1003);
check("the purchases were asked for in two pages of 1000", requests.filter((u) => u.pathname.endsWith("/credit_purchases")).map((u) => `${u.searchParams.get("offset")}/${u.searchParams.get("limit")}`), ["0/1000", "1000/1000"]);
check("pages are ordered by time, then by session id, so they cannot overlap", requests.find((u) => u.pathname.endsWith("/credit_purchases")).searchParams.get("order"), "created_at.asc,stripe_session_id.asc");
check("the visitor query starts at the first day of the history", requests.find((u) => u.pathname.endsWith("/analytics_daily") && u.searchParams.get("select") !== "day").searchParams.get("day"), `gte.${addDays("2026-10-06", -(HISTORY_DAYS - 1))}`);

mode = "missing";
check("a missing analytics table is reported as such (migration not applied)", (await loadAdminStats(NOW)).status, "missing_tables");
mode = "broken";
result = await loadAdminStats(NOW);
check("a database error is reported with its message, not thrown", [result.status, result.message], ["error", "the database is on fire"]);
await new Promise((resolve) => server.close(resolve));
restore();

console.log(failures === 0 ? "\nAll statistics checks passed." : `\n${failures} check(s) FAILED.`);
// exitCode instead of process.exit(): exiting while fetch's sockets are still closing aborts Node on Windows
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)").
process.exitCode = failures === 0 ? 0 : 1;
