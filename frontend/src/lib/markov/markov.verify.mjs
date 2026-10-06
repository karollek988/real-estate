// Standalone verification for the Markov simulator's model and engine (no test
// framework in this project - see helpers.verify.mjs). Run with:
//   npx tsx src/lib/markov/markov.verify.mjs
import { isDeepStrictEqual } from "node:util";
import { cohort, seriesOf, simulate, sum } from "./engine.ts";
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
import { DEFAULT_FIELDS, FIELD, fieldsFromParams, fieldsFromStored, parseFields, percentText, readNumber, sameField, serializeFields } from "./fields.ts";

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

/** A model with only the moves given, everything else zero. */
const only = (transitions, extra = {}) => ({ ...DEFAULT_PARAMS, newVisitors: 0, initial: { ...DEFAULT_PARAMS.initial }, months: 12, ...extra, transitions });

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
const sim = simulate({ ...DEFAULT_PARAMS, initial: { ...DEFAULT_PARAMS.initial, engaged: 500, premium: 120 } });
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
check("a cohort is the same whatever the new visitors per month are", JSON.stringify(cohort({ ...DEFAULT_PARAMS, newVisitors: 5 })) === JSON.stringify(cohort({ ...DEFAULT_PARAMS, newVisitors: 5000 })), true);

// nobody can become premium
const none = cohort(only({ "visited>engaged": 1, "engaged>inactive": 1 }, { months: 12 }));
check("when no route reaches premium: 0 % and no average month", [none.everPremium, none.meanMonthsToPremium, none.premiumMonthsPerVisitor], [0, null, 0]);

// a premium cohort member who leaves still counts as having bought
const left = cohort(only({ "visited>engaged": 1, "engaged>premium": 1, "premium>churned": 1 }, { months: 12 }));
check("someone who buys and then leaves has still bought", [left.everPremium, Math.round(left.distribution.premium), Math.round(left.distribution.churned)], [1, 0, 1000]);

// more bounce means fewer buyers (monotone in the right direction)
const lessBounce = cohort({ ...DEFAULT_PARAMS, transitions: { ...DEFAULT_PARAMS.transitions, "visited>bounced": 0.5, "visited>engaged": 0.42 } });
const base = cohort(DEFAULT_PARAMS);
check("a lower bounce rate gives more eventual buyers", lessBounce.everPremium > base.everPremium, true);
const better = simulate({ ...DEFAULT_PARAMS, transitions: { ...DEFAULT_PARAMS.transitions, "inactive>reactivated": 0.15 } });
const baseSim = simulate(DEFAULT_PARAMS);
check("a stronger win-back of inactive people gives more premium customers after two years", seriesOf(better, "premium").at(-1) > seriesOf(baseSim, "premium").at(-1), true);

// ── the example numbers, as a sanity read ────────────────────────────────────
const out = simulate(DEFAULT_PARAMS);
const cb = cohort(DEFAULT_PARAMS);
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
check("a negative number is reported", Object.keys(parseFields({ ...DEFAULT_FIELDS, [FIELD.newVisitors]: "-5" }).errors), ["newVisitors"]);
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

// ── saved settings ───────────────────────────────────────────────────────────
const saved = serializeFields({ ...DEFAULT_FIELDS, [FIELD.edge("visited>engaged")]: "40" });
check("saved settings come back", fieldsFromStored(saved)[FIELD.edge("visited>engaged")], "40");
check("nothing saved: the defaults", fieldsFromStored(""), DEFAULT_FIELDS);
check("damaged settings: the defaults, no crash", [fieldsFromStored("{not json"), fieldsFromStored('{"v":99,"fields":{}}'), fieldsFromStored("null"), fieldsFromStored('{"v":1,"fields":"x"}')].every((f) => f === DEFAULT_FIELDS), true);
check("unknown or non-text entries are ignored, long ones too", (() => { const f = fieldsFromStored(JSON.stringify({ v: 1, fields: { "edge:visited>engaged": 99, "evil": "x", "edge:engaged>premium": "9".repeat(50), "edge:engaged>registered": "20" } })); return [f["edge:visited>engaged"], f["evil"], f["edge:engaged>premium"], f["edge:engaged>registered"]]; })(), [DEFAULT_FIELDS["edge:visited>engaged"], undefined, DEFAULT_FIELDS["edge:engaged>premium"], "20"]);

console.log(failures === 0 ? "\nAll Markov checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
