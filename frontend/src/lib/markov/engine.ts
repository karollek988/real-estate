/**
 * The arithmetic of the simulator: no browser, no database, so it runs the same
 * on the server and in the page, and markov.verify.mjs can test it directly.
 *
 * Timing, month by month: the month's new visitors arrive in "visited" at the
 * start of the month, then everyone moves (or stays) according to the matrix, and
 * the result is the population at the end of the month. So someone who arrives
 * in month 3 can bounce, or become engaged, within month 3.
 *
 * Where visitors come from matters only while they are still "visited": a visitor from a
 * channel with quality q is q times as likely to become engaged (the extra comes out of the
 * chance of bouncing, so the chance of deciding either way is unchanged). So "visited" is kept
 * as one pool per channel, plus a neutral pool (quality 1) for typed-in visitors and for
 * people who come back from "bounce". Every other state is a single shared population.
 */
import { CHANNEL_IDS, acquisitionPlan, qualityOf, type ChannelId } from "./acquisition";
import { TRACKED_IDS, buildMatrix, type MarkovParams, type TrackedId } from "./model";

const N = TRACKED_IDS.length;
const index = (id: TrackedId) => TRACKED_IDS.indexOf(id);
const VISITED = index("visited");
const ENGAGED = index("engaged");
const BOUNCED = index("bounced");
const PREMIUM = index("premium");

/** one pool of "visited" per channel, then the neutral one */
const POOLS = CHANNEL_IDS.length + 1;
const NEUTRAL = CHANNEL_IDS.length;

/** Everyone, split the way the engine needs: `visited[pool]`, and `others[state]` (the visited slot of `others` is unused). */
interface Split {
  visited: number[];
  others: number[];
}

const zeros = (length: number) => new Array<number>(length).fill(0);

// ── inputs of a run ──────────────────────────────────────────────────────────

/** Arrivals per pool and month (`[pool][month]`, month 0 is 0), and the ad spend per month. */
function arrivalsOf(params: MarkovParams): { pools: number[][]; spend: number[] } {
  const months = params.months;
  const pools = Array.from({ length: POOLS }, () => zeros(months + 1));
  if (params.acquisition.mode === "channels") {
    const plan = acquisitionPlan(params.acquisition, months);
    CHANNEL_IDS.forEach((id, p) => (pools[p] = plan.channels[id]));
    return { pools, spend: plan.spend };
  }
  for (let t = 1; t <= months; t++) pools[NEUTRAL][t] = params.newVisitors;
  return { pools, spend: zeros(months + 1) };
}

/** The chance of each move out of "visited" for a visitor of quality q: more engaged, fewer bounces, the same total. */
function visitedRow(P: number[][], quality: number): number[] {
  const row = P[VISITED].slice();
  const decides = row[ENGAGED] + row[BOUNCED];
  row[ENGAGED] = Math.min(decides, quality * row[ENGAGED]);
  row[BOUNCED] = decides - row[ENGAGED];
  return row;
}

/** One row of "visited" per pool. Without channels, every pool is the ordinary one. */
function visitedRows(P: number[][], params: MarkovParams): number[][] {
  const channels = params.acquisition.mode === "channels";
  return Array.from({ length: POOLS }, (_, p) => visitedRow(P, channels && p < NEUTRAL ? qualityOf(params.acquisition, CHANNEL_IDS[p]) : 1));
}

function startOf(population: Record<TrackedId, number>): Split {
  const visited = zeros(POOLS);
  visited[NEUTRAL] = population.visited;
  const others = TRACKED_IDS.map((id) => (id === "visited" ? 0 : population[id]));
  return { visited, others };
}

const totals = (split: Split): number[] => split.others.map((value, i) => (i === VISITED ? split.visited.reduce((a, b) => a + b, 0) : value));

// ── one month ────────────────────────────────────────────────────────────────

/** Everyone moves once. `P` is the matrix for the shared states, `rows` the "visited" rows per pool. */
function step(from: Split, P: number[][], rows: number[][]): { next: Split; intoPremium: number } {
  const visited = zeros(POOLS);
  const others = zeros(N);
  let intoPremium = 0;
  for (let pool = 0; pool < POOLS; pool++) {
    const mass = from.visited[pool];
    if (mass === 0) continue;
    for (let j = 0; j < N; j++) {
      const moved = mass * rows[pool][j];
      if (j === VISITED) visited[pool] += moved;
      else {
        others[j] += moved;
        if (j === PREMIUM) intoPremium += moved;
      }
    }
  }
  for (let i = 0; i < N; i++) {
    if (i === VISITED) continue;
    const mass = from.others[i];
    if (mass === 0) continue;
    for (let j = 0; j < N; j++) {
      const moved = mass * P[i][j];
      if (j === VISITED) visited[NEUTRAL] += moved; // someone coming back from bounce
      else {
        others[j] += moved;
        if (j === PREMIUM && i !== PREMIUM) intoPremium += moved;
      }
    }
  }
  return { next: { visited, others }, intoPremium };
}

interface Run {
  populations: number[][];
  premiumEntries: number[];
}

/** The chain, month by month, from `start` with the given arrivals (`[pool][month]`). */
function run(P: number[][], rows: number[][], months: number, arrivals: number[][], start: Split): Run {
  let state = start;
  const populations = [totals(state)];
  const premiumEntries = [0];
  for (let t = 1; t <= months; t++) {
    const arrived: Split = { visited: state.visited.map((v, pool) => v + arrivals[pool][t]), others: state.others };
    const { next, intoPremium } = step(arrived, P, rows);
    state = next;
    populations.push(totals(state));
    premiumEntries.push(intoPremium);
  }
  return { populations, premiumEntries };
}

// ── the whole simulation ─────────────────────────────────────────────────────

export interface Simulation {
  /** 0 is the start, 1 the end of the first month, and so on */
  months: number[];
  /** populations[t][i]: people in state TRACKED_IDS[i] at the end of month t (t = 0: the starting numbers) */
  populations: number[][];
  /** new visitors that arrived in month t, all sources together (index 0 is 0: the start has none) */
  arrivals: number[];
  /** the same by channel: all zeros when the visitors are typed in by hand */
  channelArrivals: Record<ChannelId, number[]>;
  /** ad spend in kr in month t */
  spend: number[];
  /** entries[t]: people who moved into premium during month t, from any other state */
  premiumEntries: number[];
}

/** Runs the model forward for params.months months. */
export function simulate(params: MarkovParams): Simulation {
  const P = buildMatrix(params.transitions);
  const rows = visitedRows(P, params);
  const { pools, spend } = arrivalsOf(params);
  const result = run(P, rows, params.months, pools, startOf(params.initial));
  const channelArrivals = Object.fromEntries(CHANNEL_IDS.map((id, p) => [id, pools[p]])) as Record<ChannelId, number[]>;
  return {
    months: result.populations.map((_, t) => t),
    populations: result.populations,
    arrivals: pools[0].map((_, t) => pools.reduce((sum, pool) => sum + pool[t], 0)),
    channelArrivals,
    spend,
    premiumEntries: result.premiumEntries,
  };
}

/** The population of one state over time. */
export const seriesOf = (sim: Simulation, id: TrackedId): number[] => sim.populations.map((row) => row[index(id)]);

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// ── where the premium customers come from ────────────────────────────────────

export interface ChannelAttribution {
  id: ChannelId;
  /** visitors the channel brought over the whole run */
  visitors: number;
  /** people who became premium because of them (moves into premium, summed over the run) */
  premiumEntries: number;
  /** of those, how many are premium at the end */
  premiumAtEnd: number;
  /** ad spend in kr (zero for every channel but ads) */
  spend: number;
}

export interface Attribution {
  channels: ChannelAttribution[];
  /** what the people already in the states at the start contribute (the channels do not account for them) */
  startPremiumEntries: number;
  startPremiumAtEnd: number;
}

/**
 * Splits the result by channel. The model is linear - twice the visitors, twice the premium customers, and
 * two groups never affect each other - so running each channel's visitors alone, and adding the runs up,
 * gives exactly the whole result. Null when the visitors are typed in by hand: then there are no channels.
 */
export function attribute(params: MarkovParams): Attribution | null {
  if (params.acquisition.mode !== "channels") return null;
  const P = buildMatrix(params.transitions);
  const rows = visitedRows(P, params);
  const { pools, spend } = arrivalsOf(params);
  const empty = () => Array.from({ length: POOLS }, () => zeros(params.months + 1));
  const lastOf = (r: Run) => r.populations[r.populations.length - 1][PREMIUM];

  const channels = CHANNEL_IDS.map((id, p) => {
    const only = empty();
    only[p] = pools[p];
    const r = run(P, rows, params.months, only, { visited: zeros(POOLS), others: zeros(N) });
    return { id, visitors: sum(pools[p]), premiumEntries: sum(r.premiumEntries), premiumAtEnd: lastOf(r), spend: id === "ads" ? sum(spend) : 0 };
  });
  const base = run(P, rows, params.months, empty(), startOf(params.initial));
  return { channels, startPremiumEntries: sum(base.premiumEntries), startPremiumAtEnd: lastOf(base) };
}

// ── what becomes of one group of new visitors ────────────────────────────────

export interface Cohort {
  /** how many new visitors the cohort starts with */
  size: number;
  months: number;
  /** where the cohort's people are after `months` months */
  distribution: Record<TrackedId, number>;
  /** the share that has been premium at some point within the months: reaching it, even if they left again */
  everPremium: number;
  /** among those, the average month they first became premium; null if none did */
  meanMonthsToPremium: number | null;
  /** premium months per visitor: the number of month-ends spent as premium, divided by the cohort size */
  premiumMonthsPerVisitor: number;
  /** purchases per visitor: every move into premium counts, so someone who leaves and comes back counts again */
  purchasesPerVisitor: number;
}

/** How a new visitor's channel is spread: by each channel's share of all the visitors of the run (or neutral, by hand). */
function channelMix(params: MarkovParams): number[] {
  const weights = zeros(POOLS);
  if (params.acquisition.mode === "channels") {
    const { pools } = arrivalsOf(params);
    const counts = CHANNEL_IDS.map((_, p) => sum(pools[p]));
    const all = sum(counts);
    if (all > 0) {
      counts.forEach((count, p) => (weights[p] = count / all));
      return weights;
    }
  }
  weights[NEUTRAL] = 1;
  return weights;
}

/**
 * Follows one group of new visitors, and no one else, through the model: the answer to
 * "what becomes of a thousand people who find us this month?". No further arrivals. With channels,
 * the group is made up like the run's visitors are: if half come from search, half the group does.
 */
export function cohort(params: MarkovParams, size = 1000): Cohort {
  return followCohort(params, size, channelMix(params));
}

/** The same for new visitors that all come from one channel: what a visitor from it is worth, whatever its volume. */
export function cohortForChannel(params: MarkovParams, id: ChannelId, size = 1000): Cohort {
  const weights = zeros(POOLS);
  weights[CHANNEL_IDS.indexOf(id)] = 1;
  return followCohort(params, size, weights);
}

function followCohort(params: MarkovParams, size: number, weights: number[]): Cohort {
  const P = buildMatrix(params.transitions);
  const rows = visitedRows(P, params);
  const start: Split = { visited: weights.map((weight) => weight * size), others: zeros(N) };

  // the plain chain: where everyone is, and how long they spend as premium
  let x = start;
  let premiumMonthEnds = 0;
  let purchases = 0;
  // the same chain with premium as a trap: the people caught in it are exactly those who have ever been premium
  const trap = P.map((row, i) => (i === PREMIUM ? row.map((_, j) => (j === PREMIUM ? 1 : 0)) : row.slice()));
  let z = start;
  let reached = 0;
  let monthWeight = 0;

  for (let t = 1; t <= params.months; t++) {
    const stepped = step(x, P, rows);
    x = stepped.next;
    purchases += stepped.intoPremium;
    premiumMonthEnds += x.others[PREMIUM];
    z = step(z, trap, rows).next;
    monthWeight += t * (z.others[PREMIUM] - reached);
    reached = z.others[PREMIUM];
  }

  const distribution = {} as Record<TrackedId, number>;
  const final = totals(x);
  TRACKED_IDS.forEach((id, i) => (distribution[id] = final[i]));
  return {
    size,
    months: params.months,
    distribution,
    everPremium: reached / size,
    meanMonthsToPremium: reached > 0 ? monthWeight / reached : null,
    premiumMonthsPerVisitor: premiumMonthEnds / size,
    purchasesPerVisitor: purchases / size,
  };
}
