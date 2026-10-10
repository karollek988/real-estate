// Standalone verification for the map's transport info (lib/map/transport.ts): picking the nearest bus stop and train
// station out of what Transitous returns, with no network (a fake fetch stands in). No test framework in this project
// (see the other *.verify.mjs). Run with:
//   npx tsx src/lib/map/transport.verify.mjs
import { boundingBox, distanceMetres, generateTransport, parseStops, pickNearest, SEARCH_RADII_M } from "./transport.ts";

let failures = 0;
function check(name, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"} - ${name}`);
  if (!condition) {
    failures++;
    if (detail !== undefined) console.log("  detail:", detail);
  }
}

// The listing: Kanalgatan 41C, Eslöv (the first built-in example).
const HOME = { lat: 55.83626936841034, lng: 13.301669377943158 };

// What Transitous answered for it (shortened): note the same station from two feeds, a bus-only stop, a stop without
// modes, and a rotated coordinate as a string, which must be left out.
const ANSWER = [
  { name: "Eslöv station", lat: 55.83757, lon: 13.3049, modes: ["LONG_DISTANCE", "NIGHT_RAIL"] },
  { name: "Eslöv station", lat: 55.83777, lon: 13.30549, modes: ["LONG_DISTANCE", "REGIONAL_RAIL", "BUS"] },
  { name: "Eslöv Medborgarhuset", lat: 55.83468, lon: 13.30238, modes: ["BUS"] },
  { name: "Eslöv Stora Torg", lat: 55.84024, lon: 13.30368, modes: ["BUS"] },
  { name: "Ett hus utan trafik", lat: 55.8363, lon: 13.3017, modes: [] },
  { name: "Trasig", lat: "55.8363", lon: 13.3017, modes: ["BUS"] },
  { lat: 55.8363, lon: 13.3017, modes: ["BUS"] },
  null,
  "text",
];

// ── parsing ─────────────────────────────────────────────────────────────────
const stops = parseStops(ANSWER);
check("only named stops with a position are kept", stops.length === 5, stops.map((s) => s.name));
check("something that is not a list gives no stops", parseStops({}).length === 0 && parseStops(null).length === 0 && parseStops("x").length === 0);
check("a very long name is cut", parseStops([{ name: "x".repeat(300), lat: 55, lon: 13, modes: ["BUS"] }])[0].name.length === 100);

// ── picking ─────────────────────────────────────────────────────────────────
const near = pickNearest(stops, HOME.lat, HOME.lng, 2500);
check("the nearest bus stop is found, with a rounded distance", near.bus?.name === "Eslöv Medborgarhuset" && near.bus.distanceM === 180, near.bus);
check("the nearest train station is found (a stop with rail among its modes)", near.train?.name === "Eslöv station" && near.train.distanceM >= 240 && near.train.distanceM <= 270, near.train);
check("distances are rounded to 10 m", near.bus.distanceM % 10 === 0 && near.train.distanceM % 10 === 0);
check("a bus stop is not a train station and the other way round", pickNearest([{ name: "A", lat: HOME.lat, lon: HOME.lng, modes: ["BUS"] }], HOME.lat, HOME.lng, 2500).train === null);
check("metro and tram are not trains", pickNearest([{ name: "T-bana", lat: HOME.lat, lon: HOME.lng, modes: ["SUBWAY", "TRAM"] }], HOME.lat, HOME.lng, 2500).train === null);
check("a coach stop is not a bus stop", pickNearest([{ name: "Flix", lat: HOME.lat, lon: HOME.lng, modes: ["COACH"] }], HOME.lat, HOME.lng, 2500).bus === null);
check("a stop beyond the radius is not reported (the box has corners)", pickNearest(stops, HOME.lat, HOME.lng, 100).bus === null);
check("a stop on the spot is shown as at least 10 m", pickNearest([{ name: "A", lat: HOME.lat, lon: HOME.lng, modes: ["BUS"] }], HOME.lat, HOME.lng, 2500).bus.distanceM === 10);

// ── the box ─────────────────────────────────────────────────────────────────
const box = boundingBox(HOME.lat, HOME.lng, 2500);
const [minLat, minLng] = box.min.split(",").map(Number);
const [maxLat, maxLng] = box.max.split(",").map(Number);
check("the box lies around the place, about the radius to each side", minLat < HOME.lat && maxLat > HOME.lat && minLng < HOME.lng && maxLng > HOME.lng);
check("the box is about 5 km tall", Math.abs(distanceMetres(minLat, HOME.lng, maxLat, HOME.lng) - 5000) < 50, distanceMetres(minLat, HOME.lng, maxLat, HOME.lng));

// ── the whole lookup with a fake Transitous ─────────────────────────────────
const calls = [];
const fakeFetch = (answers) => async (url) => {
  calls.push(String(url));
  const next = answers.shift();
  if (next instanceof Error) throw next;
  return { ok: next.status === undefined || next.status < 400, status: next.status ?? 200, json: async () => next.body };
};
const FIXED = () => new Date("2026-10-10T12:00:00.000Z");

calls.length = 0;
const both = await generateTransport(HOME.lat, HOME.lng, fakeFetch([{ body: ANSWER }]), FIXED);
check("both found close by: one call, source and time recorded", calls.length === 1 && both.bus && both.train && both.source === "transitous" && both.fetchedAt === "2026-10-10T12:00:00.000Z" && both.searchedWithinM === SEARCH_RADII_M[0], { calls: calls.length, both });

calls.length = 0;
const widened = await generateTransport(HOME.lat, HOME.lng, fakeFetch([{ body: [{ name: "Buss", lat: 55.8365, lon: 13.3018, modes: ["BUS"] }] }, { body: [{ name: "Buss", lat: 55.8365, lon: 13.3018, modes: ["BUS"] }, { name: "Järvsö station", lat: 55.9, lon: 13.4, modes: ["REGIONAL_RAIL"] }] }]), FIXED);
check("no train in the near box: the wider box is asked, and the bus stop found first is kept", calls.length === 2 && widened.bus?.name === "Buss" && widened.train?.name === "Järvsö station" && widened.searchedWithinM === SEARCH_RADII_M[1], { calls: calls.length, widened });

calls.length = 0;
const none = await generateTransport(HOME.lat, HOME.lng, fakeFetch([{ body: [] }, { body: [] }]), FIXED);
check("nothing within the wider radius: both are null and the search distance is stated", none.bus === null && none.train === null && none.searchedWithinM === SEARCH_RADII_M[1], none);

let threw = false;
try { await generateTransport(HOME.lat, HOME.lng, fakeFetch([{ status: 503, body: null }]), FIXED); } catch { threw = true; }
check("an error answer fails the lookup (it is tried again later, never shown as 'no stops')", threw);

threw = false;
try { await generateTransport(HOME.lat, HOME.lng, fakeFetch([{ body: [] }, new Error("network down")]), FIXED); } catch { threw = true; }
check("a failure in the second call fails the whole lookup (a half answer would claim 'no train')", threw);

check("every call says who is asking and uses the stops endpoint with a box", calls.length === 0 || calls.every((u) => u.startsWith("https://api.transitous.org/api/v1/map/stops?min=") && u.includes("&max=")));

process.exit(failures === 0 ? 0 : 1);
