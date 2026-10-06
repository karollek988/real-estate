/**
 * The customer state model of the marketing simulator (admin portal, "Markov-simulator").
 *
 * A person is in one of nine states and, once a month, moves to another with
 * some probability or stays where they are. That is a Markov chain: where
 * someone goes next depends only on where they are now.
 *
 *   S0 never visited     the pool new traffic comes out of - not tracked as a
 *                        population; "new visitors per month" is what leaves it
 *   S1 visited           a new visitor this month, not yet decided
 *   S2 engaged           uses the site (the map, an example report, an analysis)
 *   S3 registered        has an account, has not bought ("free user")
 *   S4 premium           a paying customer. The product sells one-time packages,
 *                        not a subscription, so for now this is "has bought";
 *                        how revenue follows from it is decided with the revenue layer
 *   S5 inactive          has gone quiet
 *   S6 churned           has left for good - or nearly: a tiny win-back chance
 *   S7 reactivated       came back after being inactive or churned
 *   S8 bounce            left straight away (added to the S0-S7 list; it is in the diagram)
 *
 * Which moves are possible is fixed (EDGES); how likely each is - the numbers -
 * are the user's to set, and the ones below are examples, not measurements.
 */

export const STATE_IDS = ["never", "visited", "engaged", "registered", "premium", "inactive", "churned", "reactivated", "bounced"] as const;
export type StateId = (typeof STATE_IDS)[number];
/** Every state that holds a population: all of them except the source. */
export type TrackedId = Exclude<StateId, "never">;
export const TRACKED_IDS: readonly TrackedId[] = STATE_IDS.filter((id): id is TrackedId => id !== "never");

export interface StateInfo {
  code: string;
  label: string;
  /** one line for the editor and the explanation */
  description: string;
}

export const STATES: Record<StateId, StateInfo> = {
  never: { code: "S0", label: "Aldrig besökt", description: "Potentiella kunder som inte har hittat webbplatsen än. Källan som ny trafik kommer ur." },
  visited: { code: "S1", label: "Besökt", description: "Ny besökare som inte har bestämt sig än." },
  engaged: { code: "S2", label: "Engagerad", description: "Använder webbplatsen: kartan, exempelrapporten eller en analys." },
  registered: { code: "S3", label: "Registrerad", description: "Har ett konto men har inte köpt (gratisanvändare)." },
  premium: { code: "S4", label: "Premium", description: "Betalande kund: har köpt ett paket." },
  inactive: { code: "S5", label: "Inaktiv", description: "Har blivit tyst och använder inte tjänsten längre." },
  churned: { code: "S6", label: "Förlorad", description: "Har lämnat för gott (churn), med en mycket liten chans att komma tillbaka." },
  reactivated: { code: "S7", label: "Återaktiverad", description: "Har kommit tillbaka efter att ha varit inaktiv eller förlorad." },
  bounced: { code: "S8", label: "Bounce", description: "Lämnade direkt utan att göra något." },
};

export type EdgeKey = `${TrackedId}>${TrackedId}`;
export const edgeKey = (from: TrackedId, to: TrackedId): EdgeKey => `${from}>${to}`;

export interface Edge {
  from: TrackedId;
  to: TrackedId;
  /** what this move means, for the editor */
  hint: string;
}

/**
 * Every move that can happen. A state that is not listed as a start here never
 * leaves (bounce, until a come-back chance is set). What is left over - one
 * minus the moves out - is the chance of staying put.
 */
export const EDGES: readonly Edge[] = [
  { from: "visited", to: "bounced", hint: "Lämnar direkt." },
  { from: "visited", to: "engaged", hint: "Börjar använda webbplatsen." },

  { from: "engaged", to: "registered", hint: "Skapar ett konto." },
  { from: "engaged", to: "premium", hint: "Köper direkt, utan att stanna som gratisanvändare." },
  { from: "engaged", to: "inactive", hint: "Tappar intresset och blir tyst." },

  { from: "registered", to: "premium", hint: "Köper ett paket." },
  { from: "registered", to: "inactive", hint: "Blir tyst." },
  { from: "registered", to: "churned", hint: "Lämnar för gott, till exempel tar bort kontot." },

  { from: "premium", to: "inactive", hint: "Använder inte tjänsten längre." },
  { from: "premium", to: "churned", hint: "Lämnar för gott." },

  { from: "inactive", to: "reactivated", hint: "Kommer tillbaka, till exempel efter ett utskick." },
  { from: "inactive", to: "churned", hint: "Ger upp för gott." },

  { from: "churned", to: "reactivated", hint: "Vinns tillbaka (en mycket liten chans)." },

  { from: "reactivated", to: "engaged", hint: "Börjar använda tjänsten igen." },
  { from: "reactivated", to: "premium", hint: "Köper." },
  { from: "reactivated", to: "inactive", hint: "Blir tyst igen." },

  { from: "bounced", to: "visited", hint: "Kommer tillbaka som besökare, till exempel efter retargeting. Noll tills du sätter den." },
];

/** The moves out of one state. */
export const edgesFrom = (from: TrackedId): Edge[] => EDGES.filter((edge) => edge.from === from);

export interface MarkovParams {
  /** people entering "visited" each month: what the acquisition model will supply */
  newVisitors: number;
  /** people already in each state when the run starts */
  initial: Record<TrackedId, number>;
  /** chance per month of each move, 0 to 1 */
  transitions: Partial<Record<EdgeKey, number>>;
  /** how many months to run */
  months: number;
}

export const MONTH_CHOICES = [12, 24, 36] as const;

const zeroPopulation = (): Record<TrackedId, number> => ({ visited: 0, engaged: 0, registered: 0, premium: 0, inactive: 0, churned: 0, reactivated: 0, bounced: 0 });

/** Example numbers to start from. Assumptions, not measurements: the site does not yet measure registration, engagement or return. */
export const DEFAULT_PARAMS: MarkovParams = {
  newVisitors: 3000,
  initial: zeroPopulation(),
  months: 24,
  // Chosen so that a new visitor has roughly a 3 % chance of ever buying, which is the order of
  // magnitude to expect for a niche paid service. Replace them with your own estimates.
  transitions: {
    "visited>bounced": 0.68,
    "visited>engaged": 0.25,
    "engaged>registered": 0.1,
    "engaged>premium": 0.02,
    "engaged>inactive": 0.28,
    "registered>premium": 0.04,
    "registered>inactive": 0.2,
    "registered>churned": 0.04,
    "premium>inactive": 0.06,
    "premium>churned": 0.04,
    "inactive>reactivated": 0.04,
    "inactive>churned": 0.15,
    "churned>reactivated": 0.005,
    "reactivated>engaged": 0.35,
    "reactivated>premium": 0.06,
    "reactivated>inactive": 0.22,
    "bounced>visited": 0,
  },
};

const get = (transitions: MarkovParams["transitions"], from: TrackedId, to: TrackedId) => transitions[edgeKey(from, to)] ?? 0;

/** The chance of leaving `from` (the sum of its moves out). Must not exceed 1. */
export function leaveProbability(transitions: MarkovParams["transitions"], from: TrackedId): number {
  return edgesFrom(from).reduce((sum, edge) => sum + get(transitions, from, edge.to), 0);
}

/** The chance of staying: what is left when the moves out are taken. */
export const stayProbability = (transitions: MarkovParams["transitions"], from: TrackedId) => 1 - leaveProbability(transitions, from);

/** A row can be off by a hair after adding decimals; this much is not an error. */
export const ROW_TOLERANCE = 1e-9;

/**
 * The transition matrix over the eight tracked states: P[i][j] is the chance that
 * someone in state i is in state j a month later. Every row adds up to 1, because
 * what is not a move is a stay. Throws if a row's moves add up to more than 1.
 */
export function buildMatrix(transitions: MarkovParams["transitions"]): number[][] {
  return TRACKED_IDS.map((from, i) => {
    const row = TRACKED_IDS.map(() => 0);
    for (const edge of edgesFrom(from)) row[TRACKED_IDS.indexOf(edge.to)] += get(transitions, from, edge.to);
    const stay = 1 - row.reduce((a, b) => a + b, 0);
    if (stay < -ROW_TOLERANCE) throw new Error(`The moves out of ${from} add up to more than 100 %`);
    row[i] += Math.max(0, stay);
    return row;
  });
}
