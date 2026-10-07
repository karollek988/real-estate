// Standalone verification for the Markov simulator's model and engine (no test
// framework in this project - see helpers.verify.mjs). Run with:
//   npx tsx src/lib/markov/markov.verify.mjs
import { isDeepStrictEqual } from "node:util";
import { CHANNEL_IDS, CHANNELS, DEFAULT_ACQUISITION, acquisitionPlan, adsVisitors, adsVisitorsFor, growthVisitors } from "./acquisition.ts";
import { attribute, cohort, cohortForChannel, seriesOf, simulate, sum } from "./engine.ts";
import { DEFAULT_FINANCE, PACKAGE_IDS, PACKAGE_LABELS, companyKpis, economy, purchaseEconomics } from "./finance.ts";
import { evaluate } from "./run.ts";
import { PRESETS, cleanName, fieldsForComparison, findPreset, sameStrategy, sanitizeStrategies, serializeStrategies, strategiesFromStored } from "./strategies.ts";
import { adsBudgetFor, buildMeasured, defaultsFor, estimateMonthly, measuredFieldDefaults, purchaseMix, shiftDay } from "./measured.ts";
import { buildDemoMeasured } from "../admin/acquisitionDemo.ts";
import {
  DEFAULT_PARAMS,
  EDGES,
  STATE_IDS,
  STATES,
  TRACKED_IDS,
  buildMatrix,
  edgeKey,
  edgesFrom,
  leaveProbability,
  stayProbability,
} from "./model.ts";
import { EDGE_SHAPES, NODE_H, NODE_W, POSITIONS, SOURCE_SHAPE } from "../../components/admin/markov/diagramLayout.ts";
import { CHANNEL_PROPS, DEFAULT_FIELDS, FIELD, effectiveFields, overridesFromStored, serializeOverrides, fieldsFromParams, fieldsFromStored, parseFields, percentText, readNumber, readSigned, sameField, serializeFields } from "./fields.ts";

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${ok ? "" : `\n    got      ${JSON.stringify(actual)}\n    expected ${JSON.stringify(expected)}`}`);
}
const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;
function checkClose(name, actual, expected, tolerance = 1e-9) {
  const ok = close(actual, expected, tolerance);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${ok ? "" : `\n    got      ${actual}\n    expected ${expected}`}`);
}

/** The example numbers with the visitors typed in by hand (the way most checks below are written). */
const MANUAL = { ...DEFAULT_PARAMS, acquisition: { ...DEFAULT_ACQUISITION, mode: "manual" } };

/** A model with only the moves given, everything else zero. */
const only = (transitions, extra = {}) => ({ ...MANUAL, newVisitors: 0, initial: { ...DEFAULT_PARAMS.initial }, months: 12, ...extra, transitions });

// ── the definition ───────────────────────────────────────────────────────────
check("nine states, S0 to S8, in order", STATE_IDS.map((id) => STATES[id].code), ["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]);
check("S0 is the source and holds no population", [STATE_IDS[0], TRACKED_IDS.includes("never")], ["never", false]);
check("the user's names are kept (S1 visited ... S7 reactivated)", [STATES.visited.code, STATES.engaged.code, STATES.registered.code, STATES.premium.code, STATES.inactive.code, STATES.churned.code, STATES.reactivated.code], ["S1", "S2", "S3", "S4", "S5", "S6", "S7"]);
check("every move joins two tracked states, and no move is listed twice", [EDGES.every((e) => TRACKED_IDS.includes(e.from) && TRACKED_IDS.includes(e.to) && e.from !== e.to), new Set(EDGES.map((e) => edgeKey(e.from, e.to))).size === EDGES.length], [true, true]);
check("the diagram's moves are all there", ["visited>bounced", "visited>engaged", "engaged>registered", "engaged>premium", "engaged>inactive", "registered>premium", "registered>churned", "premium>churned", "inactive>reactivated"].every((key) => EDGES.some((e) => edgeKey(e.from, e.to) === key)), true);
check("hybrid churn flow: premium and registered can leave for good, inactive can go either way, churned can be won back", [edgesFrom("registered").some((e) => e.to === "churned"), edgesFrom("premium").some((e) => e.to === "churned"), edgesFrom("inactive").map((e) => e.to).sort(), edgesFrom("churned").map((e) => e.to)], [true, true, ["churned", "reactivated"], ["reactivated"]]);
check("bounce can only come back as a visitor", edgesFrom("bounced").map((e) => e.to), ["visited"]);
check("the example numbers: nobody leaves a state with more than 100 %", TRACKED_IDS.every((id) => leaveProbability(DEFAULT_PARAMS.transitions, id) <= 1), true);
check("...and every move has an example number", EDGES.every((e) => typeof DEFAULT_PARAMS.transitions[edgeKey(e.from, e.to)] === "number"), true);

// ── the matrix ───────────────────────────────────────────────────────────────
const P = buildMatrix(DEFAULT_PARAMS.transitions);
check("an 8 x 8 matrix", [P.length, P.every((row) => row.length === 8)], [8, true]);
check("every row adds up to exactly 1 (what is not a move is a stay)", P.every((row) => close(sum(row), 1, 1e-12)), true);
check("no chance is negative", P.every((row) => row.every((p) => p >= 0)), true);
checkClose("engaged stays put with what is left: 1 - 10 % - 2 % - 28 % = 60 %", P[TRACKED_IDS.indexOf("engaged")][TRACKED_IDS.indexOf("engaged")], 0.6);
checkClose("stayProbability agrees with the matrix", stayProbability(DEFAULT_PARAMS.transitions, "premium"), P[TRACKED_IDS.indexOf("premium")][TRACKED_IDS.indexOf("premium")]);
check("bounce never leaves in the example numbers", P[TRACKED_IDS.indexOf("bounced")][TRACKED_IDS.indexOf("bounced")], 1);
let threw = false;
try { buildMatrix({ "visited>bounced": 0.7, "visited>engaged": 0.5 }); } catch { threw = true; }
check("a row that adds up to more than 100 % is refused, not quietly fixed", threw, true);
check("a row that adds up to exactly 100 % is fine", buildMatrix({ "visited>bounced": 0.4, "visited>engaged": 0.6 })[0].every((p) => p >= 0), true);

// ── people are conserved ─────────────────────────────────────────────────────
const sim = simulate({ ...MANUAL, initial: { ...DEFAULT_PARAMS.initial, engaged: 500, premium: 120 } });
check("months run 0 to 24", [sim.months[0], sim.months.at(-1), sim.populations.length], [0, 24, 25]);
check("month 0 is the starting numbers", [sim.populations[0][TRACKED_IDS.indexOf("engaged")], sim.populations[0][TRACKED_IDS.indexOf("premium")]], [500, 120]);
check("nobody appears or vanishes: the total is what we started with plus 3000 a month", sim.populations.every((row, t) => close(sum(row), 620 + 3000 * t, 1e-6)), true);
check("no population is ever negative", sim.populations.every((row) => row.every((x) => x >= -1e-9)), true);

// ── cases with known answers ─────────────────────────────────────────────────
// 100 visitors a month, all become engaged, half of those engaged buy and half stay engaged.
const a = simulate(only({ "visited>engaged": 1, "engaged>premium": 0.5 }, { newVisitors: 100, months: 3 }));
const E = (t) => seriesOf(a, "engaged")[t];
const Pm = (t) => seriesOf(a, "premium")[t];
check("month 1: the 100 arrivals are engaged", [E(1), Pm(1)], [100, 0]);
check("month 2: 50 of them buy, 50 stay, and 100 new ones arrive and become engaged", [E(2), Pm(2)], [150, 50]);
check("month 3: engaged 150 -> 75 buy, 75 stay, +100 new = 175; premium 50 + 75 = 125", [E(3), Pm(3)], [175, 125]);
check("premium entries are counted per month (0, 0, 50, 75)", a.premiumEntries, [0, 0, 50, 75]);

// a premium customer who stays premium is not counted as entering again
const b = simulate(only({ "visited>engaged": 1, "engaged>premium": 1 }, { newVisitors: 10, months: 4 }));
check("someone who is already premium does not count as a new premium customer", b.premiumEntries, [0, 0, 10, 10, 10]);

// zero everything
const zero = simulate(only({}, { months: 6 }));
check("nothing in, nothing moving: all zeros, no NaN", zero.populations.every((row) => row.every((x) => x === 0)), true);

// ── the cohort ───────────────────────────────────────────────────────────────
// visitors all become engaged (month 1); each month an engaged person buys with 20 %, goes inactive with 20 %, stays with 60 %.
const loop = { "visited>engaged": 1, "engaged>premium": 0.2, "engaged>inactive": 0.2 };
const c = cohort(only(loop, { months: 36 }));
checkClose("the chance to ever buy is 0.2 / (0.2 + 0.2) = 50 % (geometric loop, closed form)", c.everPremium, 0.5, 1e-6);
checkClose("the average month of the first purchase: month 1 (engaged) + 1 / 0.4 months = 3.5", c.meanMonthsToPremium, 3.5, 1e-3);
check("the cohort ends up where the chain says: half the buyers stay premium", [Math.round(c.distribution.premium), Math.round(c.distribution.inactive)], [500, 500]);
checkClose("premium months per visitor: the sum over 36 month-ends of 0.5 x (1 - 0.6^(t-1)) = 0.5 x (36 - 2.5) = 16.75", c.premiumMonthsPerVisitor, 16.75, 1e-6);

// straight line: visited -> engaged -> premium, always
const line = cohort(only({ "visited>engaged": 1, "engaged>premium": 1 }, { months: 12 }));
check("a certain route: everyone gets there, in month 2", [line.everPremium, line.meanMonthsToPremium], [1, 2]);
checkClose("...and then spends the 11 remaining month-ends as premium", line.premiumMonthsPerVisitor, 11);

// a cohort is not affected by the arrival rate
check("a cohort is the same whatever the new visitors per month are", JSON.stringify(cohort({ ...MANUAL, newVisitors: 5 })) === JSON.stringify(cohort({ ...MANUAL, newVisitors: 5000 })), true);

// nobody can become premium
const none = cohort(only({ "visited>engaged": 1, "engaged>inactive": 1 }, { months: 12 }));
check("when no route reaches premium: 0 % and no average month", [none.everPremium, none.meanMonthsToPremium, none.premiumMonthsPerVisitor], [0, null, 0]);

// a premium cohort member who leaves still counts as having bought
const left = cohort(only({ "visited>engaged": 1, "engaged>premium": 1, "premium>churned": 1 }, { months: 12 }));
check("someone who buys and then leaves has still bought", [left.everPremium, Math.round(left.distribution.premium), Math.round(left.distribution.churned)], [1, 0, 1000]);

// more bounce means fewer buyers (monotone in the right direction)
const lessBounce = cohort({ ...MANUAL, transitions: { ...DEFAULT_PARAMS.transitions, "visited>bounced": 0.5, "visited>engaged": 0.42 } });
const base = cohort(MANUAL);
check("a lower bounce rate gives more eventual buyers", lessBounce.everPremium > base.everPremium, true);
const better = simulate({ ...MANUAL, transitions: { ...DEFAULT_PARAMS.transitions, "inactive>reactivated": 0.15 } });
const baseSim = simulate(MANUAL);
check("a stronger win-back of inactive people gives more premium customers after two years", seriesOf(better, "premium").at(-1) > seriesOf(baseSim, "premium").at(-1), true);

// ── the example numbers, as a sanity read ────────────────────────────────────
const out = simulate(MANUAL);
const cb = cohort(MANUAL);
console.log(
  `INFO example numbers after 24 months: premium ${Math.round(seriesOf(out, "premium").at(-1))}, entries to premium in total ${Math.round(sum(out.premiumEntries))}; a visitor ends up premium at some point with ${(cb.everPremium * 100).toFixed(1)} % (on average in month ${cb.meanMonthsToPremium?.toFixed(1)})`
);

// ── the text boxes ───────────────────────────────────────────────────────────
check("percentages are written the Swedish way", [percentText(0.005), percentText(0.3), percentText(0.0333), percentText(0)], ["0,5", "30", "3,33", "0"]);
check("numbers can be typed with a comma, a dot, a space or a percent sign", [readNumber("12,5"), readNumber("12.5"), readNumber(" 12 % "), readNumber("1 000")], [12.5, 12.5, 12, 1000]);
check("text that is not a number is not read", [readNumber(""), readNumber("abc"), readNumber("1,2,3"), readNumber("-5"), readNumber("1e3")], [null, null, null, null, null]);
check("the defaults read back to exactly the default numbers", isDeepStrictEqual(parseFields(DEFAULT_FIELDS).params, DEFAULT_PARAMS) && Object.keys(parseFields(DEFAULT_FIELDS).errors).length === 0, true);
check("fieldsFromParams and parseFields are each other's inverse", isDeepStrictEqual(parseFields(fieldsFromParams(DEFAULT_PARAMS)).params, DEFAULT_PARAMS), true);

const edited = parseFields({ ...DEFAULT_FIELDS, [FIELD.edge("visited>engaged")]: "30,5", [FIELD.newVisitors]: "4 500" });
check("an edited box changes the numbers", [edited.params.transitions["visited>engaged"], edited.params.newVisitors, Object.keys(edited.errors)], [0.305, 4500, []]);
check("a box with nonsense is reported by name, and counts as 0", (() => { const r = parseFields({ ...DEFAULT_FIELDS, [FIELD.edge("engaged>registered")]: "abc" }); return [Object.keys(r.errors), r.params.transitions["engaged>registered"]]; })(), [["edge:engaged>registered"], 0]);
check("over 100 % in one box is reported", Object.keys(parseFields({ ...DEFAULT_FIELDS, [FIELD.edge("engaged>registered")]: "101" }).errors), ["edge:engaged>registered"]);
check("a negative number is reported", Object.keys(parseFields({ ...DEFAULT_FIELDS, [FIELD.source]: "manual", [FIELD.newVisitors]: "-5" }).errors), ["newVisitors"]);
check("a row that adds up to more than 100 % is reported on the row", Object.keys(parseFields({ ...DEFAULT_FIELDS, [FIELD.edge("engaged>registered")]: "60", [FIELD.edge("engaged>premium")]: "30", [FIELD.edge("engaged>inactive")]: "20" }).errors), ["row:engaged"]);
check("a row that adds up to exactly 100 % is fine", Object.keys(parseFields({ ...DEFAULT_FIELDS, [FIELD.edge("engaged>registered")]: "50", [FIELD.edge("engaged>premium")]: "30", [FIELD.edge("engaged>inactive")]: "20" }).errors), []);
check("a month count that is not on offer falls back to the default", [parseFields({ ...DEFAULT_FIELDS, [FIELD.months]: "7" }).params.months, parseFields({ ...DEFAULT_FIELDS, [FIELD.months]: "36" }).params.months], [24, 36]);
check("comparing boxes by value, not by text", [sameField("edge:visited>engaged", { "edge:visited>engaged": "30" }, { "edge:visited>engaged": "30,0 %" }), sameField("edge:visited>engaged", { "edge:visited>engaged": "30" }, { "edge:visited>engaged": "31" })], [true, false]);

// ── the state diagram's layout (components/admin/markov/diagramLayout.ts) ────
const numbersOf = (d) => d.match(/-?\d+(?:\.\d+)?/g).map(Number);
const endsOf = (d) => { const n = numbersOf(d); return [{ x: n[0], y: n[1] }, { x: n[n.length - 2], y: n[n.length - 1] }]; };
/** true when the point lies on the outline of a state's box (within a pixel), not inside it and not away from it */
const onBox = (p, id) => {
  const { x, y } = POSITIONS[id];
  const within = (grow) => Math.abs(p.x - x) <= NODE_W / 2 + grow && Math.abs(p.y - y) <= NODE_H / 2 + grow;
  return within(1) && !within(-1);
};
check("every move in the model has an arrow in the diagram, and no arrow is left over", [EDGES.every((e) => EDGE_SHAPES[edgeKey(e.from, e.to)]), Object.keys(EDGE_SHAPES).length], [true, EDGES.length]);
check("every state has a place, and no two boxes overlap", (() => {
  const ids = Object.keys(POSITIONS);
  for (const a of ids) for (const b of ids) if (a < b && Math.abs(POSITIONS[a].x - POSITIONS[b].x) < NODE_W + 8 && Math.abs(POSITIONS[a].y - POSITIONS[b].y) < NODE_H + 8) return [a, b];
  return [ids.length, STATE_IDS.every((id) => POSITIONS[id])];
})(), [9, true]);
check("each arrow runs from the edge of its own box to the edge of the box it points at", EDGES.filter((e) => { const [from, to] = endsOf(EDGE_SHAPES[edgeKey(e.from, e.to)].d); return !(onBox(from, e.from) && onBox(to, e.to)); }).map((e) => edgeKey(e.from, e.to)), []);
check("the source arrow runs from S0 to S1", (() => { const [from, to] = endsOf(SOURCE_SHAPE); return [onBox(from, "never"), onBox(to, "visited")]; })(), [true, true]);

// ── the acquisition model (acquisition.ts) and channel quality in the engine ─
const growing = { start: 1000, growth: 0.1, cap: 5000, quality: 1 };
checkClose("a growing channel: month 1 is the start", growthVisitors(growing, 1), 1000);
checkClose("...month 3 is start x 1.1^2", growthVisitors(growing, 3), 1210);
checkClose("...and it stops at the ceiling", growthVisitors(growing, 40), 5000);
checkClose("a shrinking channel (-10 % a month) loses a tenth each month", growthVisitors({ ...growing, growth: -0.1 }, 2), 900);

const ads = { budget: 0, costPerVisitor: 10, doublingSpend: 10_000, from: 3, to: 5, quality: 1 };
checkClose("ads: at the doubling spend each visitor costs twice as much (10000 kr at 20 kr = 500 visitors)", adsVisitorsFor(ads, 10_000), 500);
checkClose("ads: a small budget buys about budget / cost per visitor", adsVisitorsFor(ads, 100), 100 / 10, 0.11);
checkClose("ads: however much is spent, visitors stay under doubling spend / cost per visitor (1000)", adsVisitorsFor(ads, 1e12), 1000, 1e-3);
check("ads: doubling the budget does not double the visitors", adsVisitorsFor(ads, 20_000) < 2 * adsVisitorsFor(ads, 10_000), true);
check("ads: only run in their months, and not without a budget", [3, 2, 5, 6].map((m) => adsVisitors({ ...ads, budget: 10_000 }, m) > 0).concat(adsVisitors(ads, 4) > 0), [true, false, true, false, false]);

const plan = acquisitionPlan(DEFAULT_ACQUISITION, 24);
check("a plan has a slot per month, month 0 empty, for every channel", [plan.channels.seo.length, plan.channels.seo[0], CHANNEL_IDS.every((id) => plan.channels[id].length === 25 && plan.channels[id][0] === 0)], [25, 0, true]);
checkClose("the example channels bring about 3 000 visitors in month 1", plan.total[1], 1200 + (15000 * 40000) / (12 * 55000) + 400 + 200 + 300, 1e-6);
check("the total is the sum of the channels, every month", plan.total.every((t, month) => Math.abs(t - CHANNEL_IDS.reduce((s, id) => s + plan.channels[id][month], 0)) < 1e-9), true);
check("ad spend is the budget in the months ads run", [plan.spend[0], plan.spend[1], plan.spend[24]], [0, 15000, 15000]);
check("every channel is described", CHANNEL_IDS.every((id) => CHANNELS[id].label && CHANNELS[id].description && CHANNELS[id].kind), true);
check("every channel box has a default text", CHANNEL_IDS.every((id) => CHANNEL_PROPS[id].every((prop) => typeof DEFAULT_FIELDS[FIELD.channel(id, prop)] === "string")), true);

/** No visitors from any channel, but with the ordinary probabilities: set the channels you want on top. */
const quiet = { seo: { ...DEFAULT_ACQUISITION.seo, start: 0, cap: 0 }, ads: { ...DEFAULT_ACQUISITION.ads, budget: 0 }, social: { ...DEFAULT_ACQUISITION.social, start: 0, cap: 0 }, ai: { ...DEFAULT_ACQUISITION.ai, start: 0, cap: 0 }, direct: { visitors: 0, quality: 1 } };
const channelsOnly = (patch, transitions, extra = {}) => ({ ...MANUAL, newVisitors: 0, initial: { ...MANUAL.initial }, months: 12, ...extra, transitions, acquisition: { mode: "channels", ...quiet, ...patch } });
const decide = { "visited>bounced": 0.68, "visited>engaged": 0.25 };

const q2 = simulate(channelsOnly({ direct: { visitors: 1000, quality: 2 } }, decide, { months: 1 }));
const end = (sim, id) => seriesOf(sim, id).at(-1);
checkClose("quality 2: twice as many engage (500 instead of 250)", end(q2, "engaged"), 500);
checkClose("...the extra comes out of the bounces (430 instead of 680)", end(q2, "bounced"), 430);
checkClose("...and the 7 % who do not decide are unchanged", end(q2, "visited"), 70);
const q10 = simulate(channelsOnly({ direct: { visitors: 1000, quality: 10 } }, decide, { months: 1 }));
check("a huge quality cannot make more people engage than decide (all 930, no bounces)", [Math.round(end(q10, "engaged")), Math.round(end(q10, "bounced"))], [930, 0]);
const q0 = simulate(channelsOnly({ direct: { visitors: 1000, quality: 0 } }, decide, { months: 1 }));
check("quality 0: nobody engages, all 930 who decide bounce", [Math.round(end(q0, "engaged")), Math.round(end(q0, "bounced"))], [0, 930]);

const sameAsTyped = simulate(channelsOnly({ direct: { visitors: 700, quality: 1 } }, DEFAULT_PARAMS.transitions));
const typed700 = simulate({ ...MANUAL, newVisitors: 700, initial: { ...MANUAL.initial }, months: 12 });
check("one channel at quality 1 behaves exactly like typing the same number in", sameAsTyped.populations.every((row, t) => row.every((value, i) => Math.abs(value - typed700.populations[t][i]) < 1e-6)), true);
check("typed in by hand: the channels are ignored and bring nothing", (() => {
  const wild = simulate({ ...MANUAL, acquisition: { ...DEFAULT_ACQUISITION, mode: "manual", seo: { start: 9e6, growth: 1, cap: 9e9, quality: 5 } } });
  const plain = simulate(MANUAL);
  return [JSON.stringify(wild.populations) === JSON.stringify(plain.populations), sum(wild.channelArrivals.seo), attribute(MANUAL)];
})(), [true, 0, null]);

const withStart = { ...DEFAULT_PARAMS, initial: { ...DEFAULT_PARAMS.initial, engaged: 500, premium: 120 } };
const chain = simulate(withStart);
const everyone = sum(chain.populations.at(-1));
checkClose("channels: people are conserved (what is in the states = start + everyone who arrived)", everyone, 620 + sum(chain.arrivals), 1e-6);
check("channels: the monthly arrivals are the plan's total", chain.arrivals.every((value, t) => Math.abs(value - plan.total[Math.min(t, 24)]) < 1e-9), true);

const split = attribute(withStart);
const premiumTotal = sum(chain.premiumEntries);
checkClose("by channel: the channels' premium entries and the start's add up to the whole", sum(split.channels.map((c) => c.premiumEntries)) + split.startPremiumEntries, premiumTotal, 1e-6);
checkClose("by channel: ...and so do the premium customers at the end", sum(split.channels.map((c) => c.premiumAtEnd)) + split.startPremiumAtEnd, end(chain, "premium"), 1e-6);
checkClose("by channel: visitors per channel add up to all arrivals", sum(split.channels.map((c) => c.visitors)), sum(chain.arrivals), 1e-6);
check("by channel: only ads cost anything, and 24 months of 15 000 kr is 360 000", [split.channels.filter((c) => c.spend > 0).map((c) => c.id), split.channels.find((c) => c.id === "ads").spend], [["ads"], 360_000]);
check("by channel: a higher quality earns more premium per visitor (AI 1.4 vs social 0.6)", (() => {
  const rate = (id) => { const c = split.channels.find((x) => x.id === id); return c.premiumEntries / c.visitors; };
  return rate("ai") > rate("seo") && rate("seo") > rate("social");
})(), true);

const aloneSeo = channelsOnly({ seo: { start: 1000, growth: 0, cap: 1000, quality: 1 } }, DEFAULT_PARAMS.transitions, { months: 24 });
const aloneAi = channelsOnly({ ai: { start: 3000, growth: 0, cap: 3000, quality: 1.5 } }, DEFAULT_PARAMS.transitions, { months: 24 });
const mix = channelsOnly({ seo: aloneSeo.acquisition.seo, ai: aloneAi.acquisition.ai }, DEFAULT_PARAMS.transitions, { months: 24 });
checkClose("a cohort made up of two channels is the average of their cohorts, weighted by visitors (1 : 3)", cohort(mix).everPremium, 0.25 * cohort(aloneSeo).everPremium + 0.75 * cohort(aloneAi).everPremium, 1e-9);
check("a cohort from a channel with better quality buys more often", cohort(aloneAi).everPremium > cohort(aloneSeo).everPremium, true);
const noChannelVisitors = cohort({ ...mix, acquisition: { mode: "channels", ...quiet } });
checkClose("a channel plan with no visitors at all still has a cohort (the ordinary visitor)", noChannelVisitors.everPremium, cohort(MANUAL).everPremium, 1e-9);
console.log(`INFO example channels after 24 months: premium ${Math.round(end(simulate(DEFAULT_PARAMS), "premium"))}, ${(cohort(DEFAULT_PARAMS).everPremium * 100).toFixed(1)} % of visitors ever premium; per channel (premium entries / visitors x 1000): ${split.channels.map((c) => `${c.id} ${((c.premiumEntries / c.visitors) * 1000).toFixed(0)}`).join(", ")}`);

// ── the channel boxes ────────────────────────────────────────────────────────
const channelBox = (id, prop) => FIELD.channel(id, prop);
const edit = (patch) => parseFields({ ...DEFAULT_FIELDS, ...patch });
const grown = edit({ [channelBox("seo", "growth")]: "5", [channelBox("ai", "growth")]: "-3,5", [channelBox("ads", "cpv")]: "9,5" });
check("channel boxes change the numbers (percent -> fraction, comma decimals)", [grown.params.acquisition.seo.growth, grown.params.acquisition.ai.growth, grown.params.acquisition.ads.costPerVisitor, Object.keys(grown.errors)], [0.05, -0.035, 9.5, []]);
check("a typographic minus is read too", readSigned("−3,5"), -3.5);
check("comparing boxes with a minus sign by value", [sameField(channelBox("ai", "growth"), { [channelBox("ai", "growth")]: "-3" }, { [channelBox("ai", "growth")]: "-3,0" }), sameField(channelBox("ai", "growth"), { [channelBox("ai", "growth")]: "-3" }, { [channelBox("ai", "growth")]: "3" })], [true, false]);
check("a channel box with nonsense is reported by name", Object.keys(edit({ [channelBox("social", "start")]: "abc" }).errors), ["channel:social:start"]);
check("growth outside -50 to 100 % is reported", Object.keys(edit({ [channelBox("seo", "growth")]: "150", [channelBox("social", "growth")]: "-60" }).errors).sort(), ["channel:seo:growth", "channel:social:growth"]);
check("quality over 5 is reported, 0 is fine", [Object.keys(edit({ [channelBox("direct", "quality")]: "6" }).errors), Object.keys(edit({ [channelBox("direct", "quality")]: "0" }).errors)], [["channel:direct:quality"], []]);
check("a cost per visitor of 0 is reported (it is divided by)", Object.keys(edit({ [channelBox("ads", "cpv")]: "0" }).errors), ["channel:ads:cpv"]);
check("a ceiling below the start is reported on the ceiling", Object.keys(edit({ [channelBox("seo", "cap")]: "500" }).errors), ["channel:seo:cap"]);
check("ads that stop before they start are reported on the last month", Object.keys(edit({ [channelBox("ads", "from")]: "10", [channelBox("ads", "to")]: "5" }).errors), ["channel:ads:to"]);
check("a month that is not a whole number 1-36 is reported", [Object.keys(edit({ [channelBox("ads", "from")]: "0" }).errors), Object.keys(edit({ [channelBox("ads", "to")]: "2,5" }).errors), Object.keys(edit({ [channelBox("ads", "to")]: "37" }).errors)], [["channel:ads:from"], ["channel:ads:to"], ["channel:ads:to"]]);
check("typed in by hand: a broken channel box is not complained about and does not change the run", (() => {
  const r = edit({ [FIELD.source]: "manual", [channelBox("seo", "start")]: "abc" });
  return [Object.keys(r.errors), r.params.acquisition.mode, r.params.acquisition.seo.start];
})(), [[], "manual", DEFAULT_ACQUISITION.seo.start]);
check("with channels: a broken 'new visitors' box is not complained about", Object.keys(edit({ [FIELD.newVisitors]: "abc" }).errors), []);
check("an unknown source text means channels", edit({ [FIELD.source]: "banana" }).params.acquisition.mode, "channels");
check("settings saved before the channels existed still load, with the example channels", (() => {
  const old = JSON.stringify({ v: 1, fields: { "edge:visited>engaged": "33", newVisitors: "4000" } });
  const f = fieldsFromStored(old);
  return [f["edge:visited>engaged"], f[FIELD.newVisitors], f[FIELD.source], f[channelBox("ai", "growth")]];
})(), ["33", "4000", "channels", "10"]);

// ── saved settings ───────────────────────────────────────────────────────────
const saved = serializeFields({ ...DEFAULT_FIELDS, [FIELD.edge("visited>engaged")]: "40" });
check("saved settings come back", fieldsFromStored(saved)[FIELD.edge("visited>engaged")], "40");
check("nothing saved: the defaults", fieldsFromStored(""), DEFAULT_FIELDS);
check("damaged settings: the defaults, no crash", [fieldsFromStored("{not json"), fieldsFromStored('{"v":99,"fields":{}}'), fieldsFromStored("null"), fieldsFromStored('{"v":1,"fields":"x"}')].every((f) => f === DEFAULT_FIELDS), true);
check("unknown or non-text entries are ignored, long ones too", (() => { const f = fieldsFromStored(JSON.stringify({ v: 1, fields: { "edge:visited>engaged": 99, "evil": "x", "edge:engaged>premium": "9".repeat(50), "edge:engaged>registered": "20" } })); return [f["edge:visited>engaged"], f["evil"], f["edge:engaged>premium"], f["edge:engaged>registered"]]; })(), [DEFAULT_FIELDS["edge:visited>engaged"], undefined, DEFAULT_FIELDS["edge:engaged>premium"], "20"]);

// ── measured traffic as the starting point (measured.ts) ─────────────────────
const TODAY = "2026-10-07";
const ago = (days) => shiftDay(TODAY, -days);
const row = (day, channel, source, visitors) => ({ day, channel, source, visitors });

check("days are counted the plain calendar way", [shiftDay("2026-10-07", -29), shiftDay("2026-03-01", -1), shiftDay("2026-12-31", 1)], ["2026-09-08", "2026-02-28", "2027-01-01"]);

const m1 = buildMeasured(
  [row(TODAY, "seo", "google", 50), row(ago(3), "seo", "bing", 10), row(ago(3), "ai", "chatgpt", 10), row(ago(5), "direct", "none", 20), row(ago(40), "seo", "google", 999), row(ago(2), "email", "x", 77)],
  [{ day: TODAY, accepted: 60, declined: 100 }, { day: ago(40), accepted: 5, declined: 5 }],
  ago(10),
  TODAY
);
check("only the newest 30 days and the real channels are summed", [m1.arrivals.seo, m1.arrivals.ai, m1.arrivals.direct, m1.arrivals.ads, m1.arrivals.social], [60, 10, 20, 0, 0]);
check("banner choices in the window are summed too", [m1.accepted, m1.declined], [60, 100]);
check("the window starts the day the measuring began, when that is recent", [m1.from, m1.days], [ago(10), 11]);
check("the sources are kept, biggest first", m1.sources.map((s) => `${s.channel}/${s.source}:${s.visitors}`), ["seo/google:50", "direct/none:20", "seo/bing:10", "ai/chatgpt:10"]);
check("a long history is cut to 30 days", [buildMeasured([], [], ago(200), TODAY).days, buildMeasured([], [], ago(200), TODAY).from], [30, ago(29)]);
check("nothing measured yet: no days, no first day", [buildMeasured([], [], null, TODAY).days, buildMeasured([], [], null, TODAY).since], [0, null]);

const e1 = estimateMonthly(m1);
check("everyone new = those counted + those who declined", [e1.counted, e1.declined, e1.everyone], [90, 100, 190]);
checkClose("...so the counted are scaled up by everyone / counted", e1.scale, 190 / 90);
checkClose("a channel's share is among those counted", e1.share.seo, 60 / 90);
checkClose("a month is the scaled count over the window's days (11), at 30.4375 days a month", e1.perMonth.seo, 60 * (190 / 90) * (30.4375 / 11));
check("the monthly numbers of the channels add up to everyone's monthly number", Math.abs(CHANNEL_IDS.reduce((s, id) => s + e1.perMonth[id], 0) - 190 * (30.4375 / 11)) < 1e-9, true);
check("each channel's biggest source and its share", [e1.top.seo, e1.top.ai, e1.top.ads], [{ source: "google", share: 50 / 60 }, { source: "chatgpt", share: 1 }, null]);
check("90 counted over 11 days is enough to start from, but thin (under 100)", [e1.usable, e1.thin, e1.problem], [true, true, null]);

const enough = (counted, days) => estimateMonthly(buildMeasured([row(TODAY, "seo", "google", counted)], [], ago(days - 1), TODAY));
check("19 visitors are too few, 20 are enough", [enough(19, 30).usable, enough(20, 30).usable], [false, true]);
check("6 days are too few, 7 are enough", [enough(500, 6).usable, enough(500, 7).usable], [false, true]);
check("too little says what is missing", /19 nya besökare.*minst 20/.test(enough(19, 30).problem), true);
check("no one declined: nothing is scaled", enough(100, 30).scale, 1);
check("500 counted is not thin", enough(500, 30).thin, false);
const empty = estimateMonthly(buildMeasured([], [], null, TODAY));
check("nothing counted: no NaN anywhere, and not usable", [empty.usable, empty.scale, empty.share.seo, empty.perMonth.seo, Number.isNaN(empty.perMonth.seo)], [false, 1, 0, 0, false]);

// from the estimate to the boxes
const big = estimateMonthly(buildMeasured([row(TODAY, "seo", "google", 600), row(TODAY, "ai", "chatgpt", 60), row(TODAY, "social", "facebook", 90), row(TODAY, "direct", "none", 250)], [{ day: TODAY, accepted: 1000, declined: 1000 }], ago(29), TODAY));
const filled = measuredFieldDefaults(big);
check("each channel's level is its estimated month (x2 for the decliners, x30.4375/30 for the month: 600 x 2 x 1.01458 = 1217.5, rounded to 1218)", [filled["channel:seo:start"], filled["channel:ai:start"], filled["channel:social:start"], filled["channel:direct:visitors"]].map((v) => Number(v.replace(",", "."))), [1218, 122, 183, 507]);
check("growth starts at 0: the traffic stays as it is", [filled["channel:seo:growth"], filled["channel:social:growth"], filled["channel:ai:growth"]], ["0", "0", "0"]);
check("the ceiling never sits below the level (at least 3 x it, or the example ceiling)", [filled["channel:seo:cap"], filled["channel:ai:cap"]], ["6000", "4000"]);
check("no ads measured, no budget", filled["channel:ads:budget"], "0");
check("quality and every other box are not measured", Object.keys(filled).some((name) => name.endsWith(":quality") || name.startsWith("edge:") || name === "months"), false);

const adsEx = DEFAULT_ACQUISITION.ads;
check("an ad budget that brings the measured ad visitors: the ad curve run backwards", [500, 1500, 3000].every((v) => Math.abs(adsVisitorsFor(adsEx, adsBudgetFor(v)) - v) < 0.1), true);
check("no budget for no ad visitors; a huge number is held at 20 x the doubling spend", [adsBudgetFor(0), adsBudgetFor(-5), adsBudgetFor(1e6)], [0, 0, 800_000]);
const withAds = measuredFieldDefaults(estimateMonthly(buildMeasured([row(TODAY, "ads", "google", 300), row(TODAY, "seo", "google", 300)], [], ago(29), TODAY)));
check("ads measured: the budget reproduces them", Math.abs(adsVisitorsFor(adsEx, Number(withAds["channel:ads:budget"])) - 304.375) < 0.5, true);

check("with nothing measured, or too little, every box has its example text", [defaultsFor(null).fields === DEFAULT_FIELDS, defaultsFor(buildMeasured([row(TODAY, "seo", "google", 5)], [], ago(29), TODAY)).fields === DEFAULT_FIELDS, defaultsFor(null).measuredNames.size], [true, true, 0]);
const real = defaultsFor(buildMeasured([row(TODAY, "seo", "google", 600), row(TODAY, "ai", "chatgpt", 60), row(TODAY, "social", "facebook", 90), row(TODAY, "direct", "none", 250)], [{ day: TODAY, accepted: 1000, declined: 1000 }], ago(29), TODAY));
check("with enough measured, the channel boxes are measured and the rest stay as they were", [real.fields["channel:seo:start"] !== DEFAULT_FIELDS["channel:seo:start"], real.fields["edge:visited>engaged"] === DEFAULT_FIELDS["edge:visited>engaged"], real.fields["channel:ai:quality"] === DEFAULT_FIELDS["channel:ai:quality"], real.measuredNames.has("channel:seo:start"), real.measuredNames.has("channel:ai:quality")], [true, true, true, true, false]);
const realParsed = parseFields(real.fields);
check("the measured starting boxes make a model that can be run, with nothing to correct", Object.keys(realParsed.errors).length, 0);
check("...which starts from the measured levels and stays flat", [realParsed.params.acquisition.seo.start, realParsed.params.acquisition.seo.growth, acquisitionPlan(realParsed.params.acquisition, 24).channels.seo[24]], [1218, 0, 1218]);
check("...and simulates", simulate(realParsed.params).populations.length, 25);

const demo = defaultsFor(buildDemoMeasured(TODAY));
check("the development demo data is usable, flagged as demo, and mostly search", [demo.estimate.usable, buildDemoMeasured(TODAY).demo, demo.estimate.share.seo > 0.5, Object.keys(parseFields(demo.fields).errors).length], [true, true, true, 0]);

// ── typed-in boxes over the starting text ────────────────────────────────────
const typed = { "edge:visited>engaged": "40", "channel:seo:start": "1500" };
check("what is typed lies over the starting text, and the rest follows it", [effectiveFields(real.fields, typed)["channel:seo:start"], effectiveFields(real.fields, typed)["channel:ai:start"], effectiveFields(real.fields, typed)["edge:visited>engaged"]], ["1500", real.fields["channel:ai:start"], "40"]);
check("overrides round-trip through storage", overridesFromStored(serializeOverrides(typed)), typed);
check("settings saved before there were measured values (all boxes, version 1): only what differs from the examples was typed", (() => {
  const v1 = serializeFields({ ...DEFAULT_FIELDS, "edge:visited>engaged": "40", "channel:seo:start": DEFAULT_FIELDS["channel:seo:start"], [FIELD.months]: "36" });
  return Object.entries(overridesFromStored(v1)).sort();
})(), [["edge:visited>engaged", "40"], ["months", "36"]]);
check("damaged or foreign saved settings give no overrides, never a crash", ["", "{broken", "null", "[]", '{"v":9}', '{"v":2,"overrides":"x"}', '{"v":2,"overrides":null}'].map((raw) => Object.keys(overridesFromStored(raw)).length), [0, 0, 0, 0, 0, 0, 0]);
check("unknown names, non-text values and over-long text are left out", overridesFromStored(JSON.stringify({ v: 2, overrides: { "edge:visited>engaged": "41", evil: "x", "edge:engaged>premium": 5, "channel:seo:start": "9".repeat(40) } })), { "edge:visited>engaged": "41" });

// ── purchases, revenue and costs (finance.ts) ────────────────────────────────
const one = { ...DEFAULT_FINANCE, prices: { omradesanalys: 125, trygghetspaket: 125, tre_bostader: 125 }, mix: { omradesanalys: 1, trygghetspaket: 0, tre_bostader: 0 }, vat: 0.25, feePercent: 0, feeFixed: 0, fixedMonthly: 0 };

const avg = purchaseEconomics(DEFAULT_FINANCE);
checkClose("the example mix 60/35/5 at 99/499/999 kr: 284 kr paid on average", avg.paid, 0.6 * 99 + 0.35 * 499 + 0.05 * 999);
checkClose("...which is 227,2 kr without 25 % VAT", avg.revenue, 284 / 1.25);
checkClose("...with a fee of 1,5 % + 1,80 kr per purchase, weighted by the mix", avg.fee, 0.6 * (0.015 * 99 + 1.8) + 0.35 * (0.015 * 499 + 1.8) + 0.05 * (0.015 * 999 + 1.8));
checkClose("...and what is left is revenue minus the fee", avg.net, avg.revenue - avg.fee);
checkClose("with no VAT the revenue is the price paid", purchaseEconomics({ ...one, vat: 0 }).revenue, 125);
checkClose("shares that do not add up to 1 are scaled (1,2 / 0,7 / 0,1 is the same as 0,6 / 0,35 / 0,05)", purchaseEconomics({ ...DEFAULT_FINANCE, mix: { omradesanalys: 1.2, trygghetspaket: 0.7, tre_bostader: 0.1 } }).paid, avg.paid);
check("the packages are the three the site sells, with their names", [PACKAGE_IDS, PACKAGE_LABELS.trygghetspaket], [["omradesanalys", "trygghetspaket", "tre_bostader"], "Trygghetspaketet"]);

// a made-up simulation: 3 months, 10 / 20 / 0 purchases, 100 kr of ads a month
const made = (entries, spend = [0, 100, 100, 100]) => ({ months: [0, 1, 2, 3], populations: [], arrivals: [], channelArrivals: {}, spend, premiumEntries: entries });
let eco = economy(made([0, 10, 20, 0]), { ...one, fixedMonthly: 500 });
check("revenue is purchases times the price without VAT (100 kr)", eco.revenue, [0, 1000, 2000, 0]);
check("costs are ads and fixed costs (and no fee here)", eco.costs, [0, 600, 600, 600]);
check("profit is revenue minus costs, and the cumulative result adds it up", [eco.profit, eco.cumulative], [[0, 400, 1400, -600], [0, 400, 1800, 1200]]);
check("a profit from the first month: break-even from the start, the first profit month is 1", [eco.breakEven, eco.firstProfitMonth], ["start", 1]);
check("the totals agree with the months", [eco.totals.purchases, eco.totals.revenue, eco.totals.costs, eco.totals.profit, eco.totals.profit === eco.cumulative.at(-1)], [30, 3000, 1800, 1200, true]);
eco = economy(made([0, 10, 20, 0]), { ...one, fixedMonthly: 1500 });
check("costs above revenue early and late: a profit in month 2 only; the loss is never won back, so no break-even", [eco.profit, eco.cumulative, eco.firstProfitMonth, eco.breakEven], [[0, -600, 400, -1600], [0, -600, -200, -1800], 2, null]);
eco = economy(made([0, 0, 30, 30]), { ...one, fixedMonthly: 500 });
check("a loss in month 1 won back in month 2: break-even in month 2", [eco.cumulative, eco.breakEven], [[0, -600, 1800, 4200], 2]);
eco = economy(made([0, 0, 0, 0]), { ...one, fixedMonthly: 500 });
check("nothing sold: a loss, no break-even, no profit month", [eco.totals.revenue, eco.totals.profit, eco.breakEven, eco.firstProfitMonth], [0, -1800, null, null]);
eco = economy(made([0, 0, 0, 0], [0, 0, 0, 0]), { ...one, fixedMonthly: 0 });
check("nothing sold and nothing spent: no break-even to speak of", eco.breakEven, null);
eco = economy(made([0, 10, 10, 10]), { ...one, feePercent: 0.1, feeFixed: 2, fixedMonthly: 0 });
check("the payment fee is 10 % of the price paid (12,50 kr) plus 2 kr on every purchase", [eco.fees[1], eco.perPurchase.fee, eco.perPurchase.net], [145, 14.5, 85.5]);

// on a real run
const runExample = evaluate(DEFAULT_FIELDS);
check("the example fields give a run with an economy and money by channel", [runExample.run !== null, runExample.run.channels.length, Object.keys(runExample.errors).length], [true, 5, 0]);
const rr = runExample.run;
checkClose("purchases in the economy are the moves into premium of the simulation", rr.economy.totals.purchases, sum(rr.sim.premiumEntries), 1e-6);
checkClose("revenue is those purchases times the average revenue", rr.economy.totals.revenue, rr.economy.totals.purchases * rr.economy.perPurchase.revenue, 1e-6);
checkClose("the ads cost what the acquisition model says (24 x 15 000 kr)", rr.economy.totals.adSpend, 360_000, 1e-6);
checkClose("the fixed costs are 24 x 5 000 kr", rr.economy.totals.fixed, 120_000, 1e-6);
checkClose("the channels' purchases add up to all purchases (no one was there at the start)", sum(rr.channels.map((c) => c.purchases)), rr.economy.totals.purchases, 1e-6);
checkClose("...and their revenue to all revenue", sum(rr.channels.map((c) => c.revenue)), rr.economy.totals.revenue, 1e-6);
check("a channel's contribution is its revenue minus fees minus its ad spend", rr.channels.every((c) => Math.abs(c.contribution - (c.revenue - c.fees - c.adSpend)) < 1e-6), true);
check("only ads have an ad spend, an ad cost per 1 000 visitors and an ad cost per purchase", rr.channels.filter((c) => c.adSpend > 0 || c.costPer1000 !== null || c.adCostPerPurchase !== null).map((c) => c.id), ["ads"]);
checkClose("the ads' cost per purchase is their spend over their purchases", rr.channels.find((c) => c.id === "ads").adCostPerPurchase, 360_000 / rr.channels.find((c) => c.id === "ads").purchases, 1e-6);
checkClose("what 1 000 visitors are worth is purchases per visitor times the net of a purchase", rr.kpis.valuePer1000, rr.cohort.purchasesPerVisitor * 1000 * rr.economy.perPurchase.net, 1e-9);
check("a better channel is worth more per visitor (AI quality 1,4 over social 0,6)", rr.channels.find((c) => c.id === "ai").valuePer1000 > rr.channels.find((c) => c.id === "social").valuePer1000, true);
checkClose("cost per purchase is ads and fixed costs over purchases", rr.kpis.costPerPurchase, (360_000 + 120_000) / rr.economy.totals.purchases, 1e-9);
checkClose("a paying customer is worth purchases per customer times the net of a purchase", rr.kpis.valuePerCustomer, rr.kpis.purchasesPerCustomer * rr.economy.perPurchase.net, 1e-9);
check("someone who buys at all buys at least once", rr.kpis.purchasesPerCustomer >= 1 - 1e-9, true);
checkClose("the margin is profit over revenue", rr.kpis.margin, rr.economy.totals.profit / rr.economy.totals.revenue, 1e-12);
const byHand = evaluate({ ...DEFAULT_FIELDS, [FIELD.source]: "manual" });
check("typed in by hand there is no split by channel and no ad spend, but the economy is there", [byHand.run.channels, byHand.run.economy.totals.adSpend, byHand.run.economy.totals.revenue > 0], [null, 0, true]);
const dearer = evaluate({ ...DEFAULT_FIELDS, [FIELD.price("trygghetspaket")]: "699" }).run;
check("a higher price on one package raises the revenue per purchase", dearer.economy.perPurchase.revenue > rr.economy.perPurchase.revenue, true);

// purchases per visitor, in a cohort
const cycle = { "visited>engaged": 1, "engaged>premium": 1, "premium>inactive": 1, "inactive>reactivated": 1, "reactivated>premium": 1 };
check("a loop that buys every third month, from month 2: purchases in months 2, 5, 8 and 11 = 4 in a year", cohort(only(cycle, { months: 12 })).purchasesPerVisitor, 4);
check("...and 2 months is a single purchase", [cohort(only(cycle, { months: 2 })).purchasesPerVisitor, cohort(only(cycle, { months: 1 })).purchasesPerVisitor], [1, 0]);
check("buying once and staying is one purchase however long it runs", [cohort(only({ "visited>engaged": 1, "engaged>premium": 1 }, { months: 36 })).purchasesPerVisitor], [1]);
check("a visitor's purchases are at least the share who ever buy", (() => { const c = cohort(MANUAL); return c.purchasesPerVisitor >= c.everPremium - 1e-12; })(), true);
const wholeCohort = cohort(DEFAULT_PARAMS);
const plainChain = simulate(DEFAULT_PARAMS);
const mixedPlain = CHANNEL_IDS.reduce((s, id) => s + (sum(plainChain.channelArrivals[id]) / sum(plainChain.arrivals)) * cohortForChannel(DEFAULT_PARAMS, id).purchasesPerVisitor, 0);
checkClose("the whole group's purchases per visitor are its channels' weighted by their visitors (the model is linear)", wholeCohort.purchasesPerVisitor, mixedPlain, 1e-9);
check("a channel with no visitors (no ad budget) still has the value of its own kind of visitor", (() => {
  const noAds = { ...DEFAULT_PARAMS, acquisition: { ...DEFAULT_ACQUISITION, ads: { ...DEFAULT_ACQUISITION.ads, budget: 0 } } };
  const ads = cohortForChannel(noAds, "ads").everPremium;
  return [ads > 0, ads < cohortForChannel(noAds, "direct").everPremium];
})(), [true, true]);

// ── the real purchases (measured.ts) ─────────────────────────────────────────
const emptyDay = (i) => ({ day: shiftDay("2026-04-01", i), visitors: { mobile: 0, tablet: 0, desktop: 0 }, pageViews: { mobile: 0, tablet: 0, desktop: 0 }, purchases: { omradesanalys: 0, trygghetspaket: 0, tre_bostader: 0, other: 0 } });
const ledger = (bought) => Array.from({ length: 180 }, (_, i) => { const d = emptyDay(i); if (bought[i]) Object.assign(d.purchases, bought[i]); return d; });

const noPurchases = purchaseMix(ledger({}));
check("no purchases at all: nothing to start from", [noPurchases.usable, noPurchases.total, noPurchases.days, noPurchases.perMonth], [false, 0, 0, 0]);
const nine = purchaseMix(ledger({ 170: { omradesanalys: 9 } }));
check("9 purchases are too few, 10 are enough", [nine.usable, purchaseMix(ledger({ 170: { omradesanalys: 10 } })).usable], [false, true]);
check("too few says how many there are", /9 köp.*minst 10/.test(nine.problem), true);
const some = purchaseMix(ledger({ 100: { omradesanalys: 6, trygghetspaket: 3 }, 150: { omradesanalys: 5, tre_bostader: 1, other: 4 } }));
check("the counts per package, and older packages kept apart", [some.counts, some.other, some.total], [{ omradesanalys: 11, trygghetspaket: 3, tre_bostader: 1 }, 4, 15]);
check("the shares come from the three packages and add up to exactly 100 %", [some.shares, Math.round(Object.values(some.shares).reduce((a, b) => a + b, 0) * 1000)], [{ omradesanalys: 0.733, trygghetspaket: 0.2, tre_bostader: 0.067 }, 1000]);
check("shares that cannot be divided evenly still add up to 100 % (a third each)", Math.round(Object.values(purchaseMix(ledger({ 170: { omradesanalys: 4, trygghetspaket: 4, tre_bostader: 4 } })).shares).reduce((a, b) => a + b, 0) * 1000), 1000);
const old = purchaseMix(ledger({ 10: { omradesanalys: 50 }, 150: { trygghetspaket: 12 } }));
check("purchases older than 90 days are not in the mix", [old.counts, old.total], [{ omradesanalys: 0, trygghetspaket: 12, tre_bostader: 0 }, 12]);
checkClose("the window starts at the first purchase when that is later than 90 days ago: 12 purchases over 30 days", purchaseMix(ledger({ 150: { trygghetspaket: 12 } })).perMonth, (12 * 30.4375) / 30);
check("real purchases a month count the older packages too", purchaseMix(ledger({ 170: { trygghetspaket: 8, other: 4 } })).perMonth > purchaseMix(ledger({ 170: { trygghetspaket: 8 } })).perMonth, true);

const withMix = defaultsFor(null, purchaseMix(ledger({ 120: { omradesanalys: 11, trygghetspaket: 3, tre_bostader: 1 } })));
check("a usable mix becomes the starting text of the three share boxes, marked measured", [withMix.fields["revenue:mix:omradesanalys"], withMix.fields["revenue:mix:trygghetspaket"], withMix.fields["revenue:mix:tre_bostader"], withMix.measuredNames.has("revenue:mix:omradesanalys"), withMix.fields["revenue:price:omradesanalys"]], ["73,3", "20", "6,7", true, "99"]);
check("...and those boxes read without any complaint (73,3 + 20 + 6,7 = 100)", Object.keys(parseFields(withMix.fields).errors), []);
check("an unusable mix leaves the example mix", defaultsFor(null, nine).fields["revenue:mix:omradesanalys"], DEFAULT_FIELDS["revenue:mix:omradesanalys"]);
check("measured traffic and a measured mix are both laid over the examples", (() => { const d = defaultsFor(buildMeasured([row(TODAY, "seo", "google", 600), row(TODAY, "direct", "none", 100)], [{ day: TODAY, accepted: 400, declined: 300 }], ago(29), TODAY), purchaseMix(ledger({ 120: { omradesanalys: 11, trygghetspaket: 3, tre_bostader: 1 } }))); return [d.measuredNames.has("channel:seo:start"), d.measuredNames.has("revenue:mix:trygghetspaket")]; })(), [true, true]);

// the money boxes
const money = (patch) => parseFields({ ...DEFAULT_FIELDS, ...patch });
check("the example money boxes: prices from the site, 60/35/5, 25 % VAT, 1,5 % + 1,80 kr, 5 000 kr a month", [DEFAULT_FIELDS["revenue:price:omradesanalys"], DEFAULT_FIELDS["revenue:price:trygghetspaket"], DEFAULT_FIELDS["revenue:price:tre_bostader"], DEFAULT_FIELDS["revenue:mix:omradesanalys"], DEFAULT_FIELDS["revenue:vat"], DEFAULT_FIELDS["revenue:feePercent"], DEFAULT_FIELDS["revenue:feeFixed"], DEFAULT_FIELDS["costs:fixed"]], ["99", "499", "999", "60", "25", "1,5", "1,8", "5000"]);
check("typed money numbers are read (comma decimals, percent to fraction)", (() => { const f = money({ "revenue:price:trygghetspaket": "549", "revenue:vat": "12", "revenue:feePercent": "2,9", "revenue:feeFixed": "2,5", "costs:fixed": "7 500" }).params.finance; return [f.prices.trygghetspaket, f.vat, f.feePercent, f.feeFixed, f.fixedMonthly].map((v) => Math.round(v * 1e9) / 1e9); })(), [549, 0.12, 0.029, 2.5, 7500]);
check("shares that do not add up to 100 % are reported on the row, with the sum", [Object.keys(money({ "revenue:mix:omradesanalys": "70" }).errors), /110 %/.test(money({ "revenue:mix:omradesanalys": "70" }).errors["row:mix"])], [["row:mix"], true]);
check("shares off by a rounding (99,95 %) are fine", Object.keys(money({ "revenue:mix:omradesanalys": "59,95" }).errors), []);
check("a share over 100 % or a nonsense share is reported on the box (and not also as a sum)", [Object.keys(money({ "revenue:mix:tre_bostader": "abc" }).errors), Object.keys(money({ "revenue:mix:tre_bostader": "150" }).errors)], [["revenue:mix:tre_bostader"], ["revenue:mix:tre_bostader"]]);
check("a negative or unreadable price, VAT over 60 %, a fee over 20 %, a fixed fee over 100 kr are each reported", [Object.keys(money({ "revenue:price:omradesanalys": "-5" }).errors), Object.keys(money({ "revenue:vat": "61" }).errors), Object.keys(money({ "revenue:feePercent": "21" }).errors), Object.keys(money({ "revenue:feeFixed": "101" }).errors), Object.keys(money({ "costs:fixed": "abc" }).errors)], [["revenue:price:omradesanalys"], ["revenue:vat"], ["revenue:feePercent"], ["revenue:feeFixed"], ["costs:fixed"]]);
check("the money boxes are checked whichever way the visitors come in", Object.keys(parseFields({ ...DEFAULT_FIELDS, [FIELD.source]: "manual", "costs:fixed": "x" }).errors), ["costs:fixed"]);
check("a price of 0 and no fixed costs are allowed", Object.keys(money({ "revenue:price:omradesanalys": "0", "costs:fixed": "0" }).errors), []);

// ── strategies (strategies.ts) ───────────────────────────────────────────────
check("a name is trimmed, single-spaced and held to 40 characters", [cleanName("  Mer   SEO  "), cleanName("   "), cleanName("x".repeat(60)).length, cleanName("a  b\n c")], ["Mer SEO", "", 40, "a b c"]);
check("the presets: today, more SEO, ads on, AI visibility, all at once", PRESETS.map((p) => p.name), ["Nuläge", "Mer SEO", "Annonser på", "AI-synlighet", "Allt på en gång"]);
check("every preset reads without a complaint, over the examples and over measured numbers", (() => {
  const measuredDefaults = defaultsFor(buildMeasured([row(TODAY, "seo", "google", 600), row(TODAY, "ai", "chatgpt", 60), row(TODAY, "social", "facebook", 90), row(TODAY, "direct", "none", 250)], [{ day: TODAY, accepted: 1000, declined: 1000 }], ago(29), TODAY));
  return PRESETS.every((p) => [DEFAULT_FIELDS, measuredDefaults.fields].every((base) => Object.keys(parseFields(effectiveFields(base, p.overrides)).errors).length === 0));
})(), true);
check("a preset only names boxes that exist", PRESETS.every((p) => Object.keys(p.overrides).every((name) => name in DEFAULT_FIELDS)), true);
check("over measured numbers (flat) each growth preset brings more premium than today", (() => {
  const measuredDefaults = defaultsFor(buildMeasured([row(TODAY, "seo", "google", 600), row(TODAY, "ai", "chatgpt", 60), row(TODAY, "social", "facebook", 90), row(TODAY, "direct", "none", 250)], [{ day: TODAY, accepted: 1000, declined: 1000 }], ago(29), TODAY));
  const premium = (id) => evaluate(effectiveFields(measuredDefaults.fields, findPreset(id).overrides)).run.sim.populations.at(-1)[4];
  return ["preset:seo", "preset:ads", "preset:ai"].every((id) => premium(id) > premium("preset:today")) && premium("preset:all") > premium("preset:seo");
})(), true);
check("a preset is found by id, and a made-up id is not", [findPreset("preset:seo").name, findPreset("nope"), findPreset(null)], ["Mer SEO", null, null]);

const keptStrategies = sanitizeStrategies([
  { id: "a1", name: "  Min   plan ", overrides: { "channel:seo:growth": "5", evil: "x", "edge:visited>engaged": 7 } },
  { id: "a1", name: "duplicate id", overrides: {} },
  { id: "B_2", name: "bad id", overrides: {} },
  { id: "c3", name: "   ", overrides: {} },
  { id: "d4", name: 5, overrides: {} },
  "junk",
  null,
  { id: "e5", name: "Ingen ruta", overrides: "x" },
]);
check("savedStrategies strategies keep the good ones, cleaned: names tidied, unknown or non-text boxes dropped", keptStrategies, [{ id: "a1", name: "Min plan", overrides: { "channel:seo:growth": "5" } }, { id: "e5", name: "Ingen ruta", overrides: {} }]);
check("not a list is no strategies", [sanitizeStrategies(null), sanitizeStrategies({}), sanitizeStrategies("x")], [[], [], []]);
check("at most 12 are kept", sanitizeStrategies(Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, name: `S${i}`, overrides: {} }))).length, 12);
const savedStrategies = serializeStrategies(keptStrategies, "a1");
check("strategies and the active one round-trip through storage", strategiesFromStored(savedStrategies), { strategies: keptStrategies, activeId: "a1" });
check("the active one may be a preset", strategiesFromStored(serializeStrategies(keptStrategies, "preset:seo")).activeId, "preset:seo");
check("an active strategy that no longer exists is forgotten", strategiesFromStored(serializeStrategies(keptStrategies, "gone")).activeId, null);
check("damaged or foreign storage gives nothing, and does not throw", ["", "{broken", "null", "[]", '{"v":9,"strategies":[]}', '{"v":1,"strategies":"x"}'].map((raw) => strategiesFromStored(raw).strategies.length), [0, 0, 0, 0, 0, 0]);
check("a strategy that types a box to its starting text is the same as one that does not", [sameStrategy(DEFAULT_FIELDS, {}, { months: "24" }), sameStrategy(DEFAULT_FIELDS, {}, { months: "36" }), sameStrategy(DEFAULT_FIELDS, { "channel:seo:growth": "5" }, { "channel:seo:growth": "5,0" })], [true, false, true]);
check("a comparison runs every strategy over the same months", [fieldsForComparison(DEFAULT_FIELDS, { months: "12", "channel:seo:growth": "5" }, "36").months, fieldsForComparison(DEFAULT_FIELDS, { "channel:seo:growth": "5" }, "36")["channel:seo:growth"]], ["36", "5"]);

console.log(failures === 0 ? "\nAll Markov checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
