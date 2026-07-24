import type { DataProvider } from "./types";
import { nominatimGeocoder } from "./geocoding";
import { hemnetPageProvider } from "./hemnetPage";
import { booliListingProvider } from "./booli";
import { parseBotBooliProvider } from "./parseBotBooli";
import { scbDemographicsProvider } from "./scb";
import { osmAmenitiesProvider } from "./osm";
import { riksbankenInterestRateProvider } from "./riksbanken";
import { smhiClimateProvider } from "./smhi";
import { trafikverketInfrastructureProvider } from "./trafikverket";
import { locationIntelligenceProvider } from "./locationIntelligence";
import { marketIntelligenceProvider } from "./marketIntelligence";
import { brfAcquisitionProvider } from "./brfAcquisition";
import { brfFinancialsProvider } from "./brfFinancials";
import { placeholderProviders } from "./placeholders";

/**
 * Ordered list of data providers run for every analysis.
 *
 * Adding a data source = implement DataProvider in its own module under
 * providers/ and add it here (removing its placeholder, if one exists).
 * Providers run in order, so sources that enrich the property for later
 * providers (geocoding) come first. Each provider is independent — the
 * pipeline (pipeline.ts) wraps every provider.collect() call individually,
 * so one failing or being disabled never affects the others.
 *
 * Disable any provider without touching code: set
 *   DISABLED_PROVIDERS=osm_amenities,smhi_climate
 * (comma-separated ids) in the environment.
 */
const ALL_PROVIDERS: DataProvider[] = [
  nominatimGeocoder,
  hemnetPageProvider,
  booliListingProvider,
  parseBotBooliProvider,
  scbDemographicsProvider,
  osmAmenitiesProvider,
  riksbankenInterestRateProvider,
  smhiClimateProvider,
  trafikverketInfrastructureProvider,
  locationIntelligenceProvider,
  marketIntelligenceProvider,
  brfAcquisitionProvider,
  brfFinancialsProvider,
  ...placeholderProviders,
];

export function getProviders(): DataProvider[] {
  const disabled = new Set(
    (process.env.DISABLED_PROVIDERS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
  return disabled.size === 0 ? ALL_PROVIDERS : ALL_PROVIDERS.filter((p) => !disabled.has(p.id));
}
