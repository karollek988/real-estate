import type { AnalysisScope } from "../types";
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
 * Wave 0 — no dependency on any other provider's output.
 */
const WAVE_0: DataProvider[] = [
  nominatimGeocoder,
  hemnetPageProvider,
  booliListingProvider,
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
 * which is written only by the buyer's upload of the association's annual
 * report (api/properties/[id]/brf-report/route.ts) — nothing in the pipeline
 * finds or downloads a BRF report any more (the automated acquisition
 * provider was removed 2026-10-02). It is a separate wave from the rest only
 * because it is a Python-engine call that needs no other provider's output;
 * without an uploaded report it reports "not_connected".
 */
const WAVE_2: DataProvider[] = [brfFinancialsProvider];

const PROVIDER_WAVES: DataProvider[][] = [WAVE_0, WAVE_1, WAVE_2];

/**
 * The standalone Områdesanalys only needs what the area chapter reads: the
 * address verified and geocoded (Wave 0), Booli for the area's sold-price
 * trend (its output is the area chapter's price-development line; without
 * credentials it just reports not_connected), then the sources that describe
 * the surroundings (Wave 1: demographics/income, amenities, schools, commute,
 * safety/civic data). Everything else (the Hemnet listing page, BRF
 * documents, interest rates, climate, infrastructure projects, placeholders)
 * is skipped — an area report never shows it, and leaving it out keeps this a
 * ~99 kr product that's cheap to serve instead of running the full pipeline
 * for an address-only request.
 */
const AREA_ONLY_PROVIDER_IDS = new Set([
  nominatimGeocoder.id,
  booliListingProvider.id,
  scbDemographicsProvider.id,
  osmAmenitiesProvider.id,
  skolverketSchoolsProvider.id,
  commuteProvider.id,
  locationIntelligenceProvider.id,
]);

/** The source ids an area-scope run uses — the only ones whose output an area report may show. */
export const AREA_SCOPE_SOURCE_IDS: ReadonlySet<string> = AREA_ONLY_PROVIDER_IDS;

export function getProviderWaves(scope: AnalysisScope = "full"): DataProvider[][] {
  const disabled = new Set(
    (process.env.DISABLED_PROVIDERS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
  const waves = scope === "area"
    ? PROVIDER_WAVES.map((wave) => wave.filter((p) => AREA_ONLY_PROVIDER_IDS.has(p.id)))
    : PROVIDER_WAVES;
  if (disabled.size === 0) return waves;
  return waves.map((wave) => wave.filter((p) => !disabled.has(p.id)));
}
