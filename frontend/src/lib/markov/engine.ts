/**
 * The arithmetic of the simulator: no browser, no database, so it runs the same
 * on the server and in the page, and markov.verify.mjs can test it directly.
 *
 * Timing, month by month: the month's new visitors arrive in "visited" at the
 * start of the month, then everyone moves (or stays) according to the matrix, and
 * the result is the population at the end of the month. So someone who arrives
 * in month 3 can bounce, or become engaged, within month 3.
 */
import { TRACKED_IDS, buildMatrix, type MarkovParams, type TrackedId } from "./model";

const N = TRACKED_IDS.length;
const index = (id: TrackedId) => TRACKED_IDS.indexOf(id);
const VISITED = index("visited");
const PREMIUM = index("premium");

export interface Simulation {
  /** 0 is the start, 1 the end of the first month, and so on */
  months: number[];
  /** populations[t][i]: people in state TRACKED_IDS[i] at the end of month t (t = 0: the starting numbers) */
  populations: number[][];
  /** new visitors that arrived in month t (index 0 is 0: the start has none) */
  arrivals: number[];
  /** entries[t]: people who moved into premium during month t, from any other state */
  premiumEntries: number[];
}

/** Runs the model forward for params.months months, with params.newVisitors new visitors each month. */
export function simulate(params: MarkovParams): Simulation {
  const P = buildMatrix(params.transitions);
  let x = TRACKED_IDS.map((id) => params.initial[id]);
  const months = [0];
  const populations = [x.slice()];
  const arrivals = [0];
  const premiumEntries = [0];

  for (let t = 1; t <= params.months; t++) {
    const y = x.slice();
    y[VISITED] += params.newVisitors;
    const next = new Array<number>(N).fill(0);
    let intoPremium = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const moved = y[i] * P[i][j];
        next[j] += moved;
        if (j === PREMIUM && i !== PREMIUM) intoPremium += moved;
      }
    }
    x = next;
    months.push(t);
    populations.push(x.slice());
    arrivals.push(params.newVisitors);
    premiumEntries.push(intoPremium);
  }
  return { months, populations, arrivals, premiumEntries };
}

/** The population of one state over time. */
export const seriesOf = (sim: Simulation, id: TrackedId): number[] => sim.populations.map((row) => row[index(id)]);

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

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
}

/**
 * Follows one group of new visitors, and no one else, through the model: the answer to
 * "what becomes of a thousand people who find us this month?". No further arrivals.
 */
export function cohort(params: MarkovParams, size = 1000): Cohort {
  const P = buildMatrix(params.transitions);
  const start = new Array<number>(N).fill(0);
  start[VISITED] = size;

  // the plain chain: where everyone is, and how long they spend as premium
  let x = start.slice();
  let premiumMonthEnds = 0;
  // the same chain with premium as a trap: the people caught in it are exactly those who have ever been premium
  const trap = P.map((row, i) => (i === PREMIUM ? row.map((_, j) => (j === PREMIUM ? 1 : 0)) : row.slice()));
  let z = start.slice();
  let reached = 0;
  let monthWeight = 0;

  for (let t = 1; t <= params.months; t++) {
    x = step(x, P);
    premiumMonthEnds += x[PREMIUM];
    z = step(z, trap);
    monthWeight += t * (z[PREMIUM] - reached);
    reached = z[PREMIUM];
  }

  const distribution = {} as Record<TrackedId, number>;
  TRACKED_IDS.forEach((id, i) => (distribution[id] = x[i]));
  return {
    size,
    months: params.months,
    distribution,
    everPremium: reached / size,
    meanMonthsToPremium: reached > 0 ? monthWeight / reached : null,
    premiumMonthsPerVisitor: premiumMonthEnds / size,
  };
}

function step(x: number[], P: number[][]): number[] {
  const next = new Array<number>(N).fill(0);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) next[j] += x[i] * P[i][j];
  return next;
}
