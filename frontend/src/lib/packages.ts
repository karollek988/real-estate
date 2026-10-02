import {
  HUSBESIKTNING_REFERENCE_PRICE_SEK,
  OMRADESANALYS_PRICE_SEK,
  TRE_BOSTADER_COUNT,
  TRE_BOSTADER_PRICE_SEK,
  TRYGGHETSPAKET_PRICE_SEK,
  formatSek,
} from "./pricing";

/**
 * What Köpanalys sells, worded once for every page that shows it — the
 * landing page's price section, /buy, the FAQ and the chat assistant — so the
 * jury-facing copy can't drift between pages. Follows the pitch deck
 * (Kopanalys_Fororten_2026_Pitch_Deck_v7): Områdesanalys 99 kr, the
 * Trygghetspaket 499 kr as the main package, three homes for 999 kr.
 */

/** The Boendekalkyl chapter is a "lanseras inom kort" placeholder until it is built. Flip when it ships. */
export const HOUSING_COST_LIVE = false;

/** The one part of the report a person reviews before the customer sees it (lib/brf/reviews.ts). */
export const BRF_REVIEW_PROMISE = "BRF-analysen granskas av våra experter innan du får den och är klar inom 24 timmar.";
export const AREA_ANALYSIS_PROMISE = "Områdesanalysen är automatisk och klar på några minuter.";

export const PRICE_PER_PROPERTY_IN_BUNDLE = Math.round(TRE_BOSTADER_PRICE_SEK / TRE_BOSTADER_COUNT);
export const BUNDLE_SAVING = TRYGGHETSPAKET_PRICE_SEK * TRE_BOSTADER_COUNT - TRE_BOSTADER_PRICE_SEK;

export type PackageKey = "omradesanalys" | "trygghetspaket" | "tre_bostader";

export interface PackageDefinition {
  key: PackageKey;
  name: string;
  price: number;
  /** What the price covers, e.g. "en bostad". */
  priceNote: string;
  summary: string;
  includes: string[];
  /** One line under the list that helps the buyer judge the price. */
  valueNote?: string;
  badge?: string;
  highlighted?: boolean;
  ctaLabel: string;
  acceptsDiscountCode: boolean;
}

const housingCostLabel = HOUSING_COST_LIVE ? "Dolda kostnader" : "Dolda kostnader (boendekalkyl lanseras snart)";

export const PACKAGES: PackageDefinition[] = [
  {
    key: "omradesanalys",
    name: "Områdesanalys",
    price: OMRADESANALYS_PRICE_SEK,
    priceNote: "området runt en bostad",
    summary: "Automatisk analys av området runt en bostad.",
    includes: ["Service, skolor och resor", "Trygghet och samhällsdata", "Hur området utvecklas", "Klar direkt"],
    ctaLabel: "Köp Områdesanalys",
    acceptsDiscountCode: true,
  },
  {
    key: "trygghetspaket",
    name: "Trygghetspaketet",
    price: TRYGGHETSPAKET_PRICE_SEK,
    priceNote: "en bostad",
    summary: "Tre djupanalyser av en bostad: BRF, området och dolda kostnader.",
    includes: ["BRF-analys, granskad av våra experter inom 24 timmar", "Områdesanalys", housingCostLabel, "Frågor till mäklaren och föreningen"],
    valueNote: `Till jämförelse: en husbesiktning kostar runt ${formatSek(HUSBESIKTNING_REFERENCE_PRICE_SEK)} kr`,
    badge: "Huvudpaket",
    highlighted: true,
    ctaLabel: "Köp Trygghetspaketet",
    acceptsDiscountCode: true,
  },
  {
    key: "tre_bostader",
    name: "Tre bostäder",
    price: TRE_BOSTADER_PRICE_SEK,
    priceNote: "tre bostäder",
    summary: "Trygghetspaketet för tre bostäder, för dig som budar på flera.",
    includes: ["Trygghetspaketet för tre bostäder", "BRF, område och dolda kostnader för varje"],
    valueNote: `${PRICE_PER_PROPERTY_IN_BUNDLE} kr per bostad · du sparar ${BUNDLE_SAVING} kr`,
    ctaLabel: "Köp tre bostäder",
    acceptsDiscountCode: false,
  },
];

export const PRICE_FOOTNOTE = "Besiktningspriset är Anticimex pris för villa 2026. Alla priser inkl. moms.";
