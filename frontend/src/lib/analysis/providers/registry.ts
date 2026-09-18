import type { DataProvider } from "./types";
import { nominatimGeocoder } from "./geocoding";
import { hemnetPageProvider } from "./hemnetPage";
import { booliListingProvider } from "./booli";
import { scbDemographicsProvider } from "./scb";
import { osmAmenitiesProvider } from "./osm";
import { skolverketSchoolsProvider } from "./skolverketSchools";
import { commuteProvider } from "./commute";
import { riksbankenInterestRateProvider } from "./riksbanken";
import { smhiClimateProvider } from "./smhi";
import { trafikverketInfrastructureProvider } from "./trafikverket";
import { locationIntelligenceProvider } from "./locationIntelligence";
import { marketIntelligenceProvider } from "./marketIntelligence";
import { brfAcquisitionProvider } from "./brfAcquisition";
import { brfFinancialsProvider } from "./brfFinancials";
import { placeholderProviders } from "./placeholders";

/**
 * Providers run in dependency "waves" — everything in one wave runs
 * concurrently (Promise.all in pipeline.ts), and a wave only starts once
 * every provider in the previous wave has finished and its attributes/
 * propertyPatch have been merged in. This is a fixed, hand-verified grouping
 * (not a general scheduler) — each wave's placement is justified below by
 * the exact field(s) it depends on and which earlier provider sets them.
 * Adding a data source = implement DataProvider in its own module under
 * providers/, then add it to whichever wave matches what it reads (default
 * to Wave 0 if it reads nothing from `property`/`attributes`).
 *
 * Disable any provider without touching code: set
 *   DISABLED_PROVIDERS=osm_amenities,smhi_climate
 * (comma-separated ids) in the environment — applied per-wave below.
 */

/**
 * Wave 0 — no dependency on any other provider's output. Notably
 * brfAcquisitionProvider only needs extracted.hemnetUrl, not geocoding.
 */
const WAVE_0: DataProvider[] = [
  nominatimGeocoder,
  hemnetPageProvider,
  booliListingProvider,
  brfAcquisitionProvider,
  riksbankenInterestRateProvider,
  ...placeholderProviders,
];

/**
 * Wave 1 — depends on a specific Wave 0 output:
 * - osmAmenitiesProvider, skolverketSchoolsProvider, commuteProvider,
 *   smhiClimateProvider, trafikverketInfrastructureProvider,
 *   locationIntelligenceProvider all gate on property.latitude/longitude
 *   set by nominatimGeocoder.
 * - scbDemographicsProvider, marketIntelligenceProvider prefer the
 *   geocoded property.municipality (fall back to extracted.municipality).
 * None of these read a field another Wave 1 member produces — verified
 * field-by-field against every other provider's own attribute writes.
 * (parseBotBooliProvider used to run here too — disabled, see its own file
 * header for why: confirmed broken location search plus a legal-risk flag
 * in docs/legal-data-migration-plan.md.)
 */
const WAVE_1: DataProvider[] = [
  scbDemographicsProvider,
  osmAmenitiesProvider,
  skolverketSchoolsProvider,
  commuteProvider,
  smhiClimateProvider,
  trafikverketInfrastructureProvider,
  locationIntelligenceProvider,
  marketIntelligenceProvider,
];

/**
 * Wave 2 — brfFinancialsProvider reads property.attributes.brf_annual_report,
 * set by brfAcquisitionProvider (Wave 0) — per that provider's own comment:
 * "Runs before brfFinancialsProvider... so attributes.brf_annual_report is
 * set in time for that provider to pick it up." (Previously could also be
 * set by the now-removed broker-site document discovery provider.)
 */
const WAVE_2: DataProvider[] = [brfFinancialsProvider];

const PROVIDER_WAVES: DataProvider[][] = [WAVE_0, WAVE_1, WAVE_2];

export function getProviderWaves(): DataProvider[][] {
  const disabled = new Set(
    (process.env.DISABLED_PROVIDERS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
  if (disabled.size === 0) return PROVIDER_WAVES;
  return PROVIDER_WAVES.map((wave) => wave.filter((p) => !disabled.has(p.id)));
}
