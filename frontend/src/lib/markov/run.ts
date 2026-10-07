/**
 * One evaluated set of boxes, ready to show: the numbers read from the text, what is wrong with
 * them, and - when nothing is - the whole simulation with its economy. Plain functions, no React.
 */
import { CHANNEL_IDS, acquisitionPlan, type AcquisitionPlan, type ChannelId } from "./acquisition";
import { attribute, cohort, cohortForChannel, simulate, type Attribution, type Cohort, type Simulation } from "./engine";
import { parseFields, type Fields } from "./fields";
import { channelEconomics, companyKpis, economy, type ChannelEconomy, type CompanyKpis, type Economy } from "./finance";
import { TRACKED_IDS, type MarkovParams, type TrackedId } from "./model";

export const COHORT_SIZE = 1000;

export interface Run {
  sim: Simulation;
  cohort: Cohort;
  /** the channels' visitors month by month; null when the visitors are typed in by hand */
  plan: AcquisitionPlan | null;
  /** the result split by channel; null when typed in by hand */
  attribution: Attribution | null;
  /** revenue, costs and profit month by month */
  economy: Economy;
  /** the money by channel; null when typed in by hand */
  channels: ChannelEconomy[] | null;
  /** the company's numbers: cost per purchase, what a visitor and a customer are worth, the margin */
  kpis: CompanyKpis;
}

export interface Evaluated {
  params: MarkovParams;
  /** box name -> what is wrong; empty when the boxes can be run */
  errors: Record<string, string>;
  /** null while any box in use can't be read: there is nothing honest to show */
  run: Run | null;
}

export function evaluate(fields: Fields): Evaluated {
  const { params, errors } = parseFields(fields);
  if (Object.keys(errors).length > 0) return { params, errors, run: null };
  const byChannel = params.acquisition.mode === "channels";
  const sim = simulate(params);
  const whole = cohort(params, COHORT_SIZE);
  const eco = economy(sim, params.finance);
  const attribution = attribute(params);
  const cohorts = byChannel ? (Object.fromEntries(CHANNEL_IDS.map((id) => [id, cohortForChannel(params, id, COHORT_SIZE)])) as Record<ChannelId, Cohort>) : null;
  return {
    params,
    errors,
    run: {
      sim,
      cohort: whole,
      plan: byChannel ? acquisitionPlan(params.acquisition, params.months) : null,
      attribution,
      economy: eco,
      channels: attribution && cohorts ? channelEconomics(attribution, cohorts, params.finance) : null,
      kpis: companyKpis(eco, whole),
    },
  };
}

/** True when both runs cover the same number of months, so their end results can be compared. */
export const sameLength = (a: Run | null, b: Run | null) => a !== null && b !== null && a.cohort.months === b.cohort.months;

/** People per state at the end of the run. */
export function endPopulations(sim: Simulation): Record<TrackedId, number> {
  const last = sim.populations[sim.populations.length - 1];
  return Object.fromEntries(TRACKED_IDS.map((id, i) => [id, last[i]])) as Record<TrackedId, number>;
}

/** New visitors per month, on average over the run: what the "S0" box and the live bar show. */
export function averageVisitors(run: Run, params: MarkovParams): number {
  return params.acquisition.mode === "channels" ? run.sim.arrivals.reduce((a, b) => a + b, 0) / params.months : params.newVisitors;
}
