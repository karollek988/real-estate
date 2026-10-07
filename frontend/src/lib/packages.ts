import {
  HUSBESIKTNING_REFERENCE_PRICE_SEK,
  OMRADESANALYS_PRICE_SEK,
  TRE_BOSTADER_COUNT,
  TRE_BOSTADER_PRICE_SEK,
  TRYGGHETSPAKET_PRICE_SEK,
} from "./pricing";

/**
 * What Köpanalys sells, for every page that shows it - the landing page's price section, /buy, the FAQ and
 * the chat assistant - so the jury-facing copy can't drift between pages. Follows the pitch deck
 * (Kopanalys_Fororten_2026_Pitch_Deck_v7): Områdesanalys 99 kr, the Trygghetspaket 499 kr as the main
 * package, three homes for 999 kr.
 *
 * This file holds what is NOT text: which packages there are, their prices, which one is highlighted. The
 * words (names, summaries, what each includes, the buttons) are in the message files, in each language, under
 * "packages" - see packageTexts() below for how a page gets them.
 */

/** The Boendekalkyl chapter is a "lanseras inom kort" placeholder until it is built. Flip when it ships. */
export const HOUSING_COST_LIVE = false;

export const PRICE_PER_PROPERTY_IN_BUNDLE = Math.round(TRE_BOSTADER_PRICE_SEK / TRE_BOSTADER_COUNT);
export const BUNDLE_SAVING = TRYGGHETSPAKET_PRICE_SEK * TRE_BOSTADER_COUNT - TRE_BOSTADER_PRICE_SEK;

export type PackageKey = "omradesanalys" | "trygghetspaket" | "tre_bostader";

export interface PackageDefinition {
  key: PackageKey;
  price: number;
  /** What the package includes, as ids of lines in the messages (packages.items.<key>.includes.<id>). */
  includes: readonly string[];
  /** Whether a line under the list helps the buyer judge the price (packages.items.<key>.valueNote). */
  hasValueNote: boolean;
  /** Whether it carries a tag, e.g. "Huvudpaket" (packages.items.<key>.badge). */
  hasBadge: boolean;
  highlighted?: boolean;
  acceptsDiscountCode: boolean;
}

export const PACKAGES: PackageDefinition[] = [
  {
    key: "omradesanalys",
    price: OMRADESANALYS_PRICE_SEK,
    includes: ["services", "safety", "development", "instant"],
    hasValueNote: false,
    hasBadge: false,
    acceptsDiscountCode: true,
  },
  {
    key: "trygghetspaket",
    price: TRYGGHETSPAKET_PRICE_SEK,
    includes: ["brf", "area", HOUSING_COST_LIVE ? "hiddenCosts" : "hiddenCostsSoon", "questions"],
    hasValueNote: true,
    hasBadge: true,
    highlighted: true,
    acceptsDiscountCode: true,
  },
  {
    key: "tre_bostader",
    price: TRE_BOSTADER_PRICE_SEK,
    includes: ["package", "each"],
    hasValueNote: true,
    hasBadge: false,
    acceptsDiscountCode: false,
  },
];

/** The numbers that a package's texts use ({price} in a value note and so on). */
export const PACKAGE_TEXT_VALUES = {
  price: HUSBESIKTNING_REFERENCE_PRICE_SEK,
  perProperty: PRICE_PER_PROPERTY_IN_BUNDLE,
  saving: BUNDLE_SAVING,
};

/** The words of one package, in the language of the page. */
export interface PackageTexts {
  name: string;
  /** The name with soft hyphens, for a narrow table heading. */
  tableName: string;
  /** What the price covers, e.g. "en bostad". */
  priceNote: string;
  summary: string;
  includes: string[];
  /** One line under the list that helps the buyer judge the price. */
  valueNote?: string;
  badge?: string;
  ctaLabel: string;
}

/** A translator for the "packages" messages: useTranslations("packages") in a client component, getTranslations("packages") in a server one. */
type PackagesTranslator = (key: any, values?: any) => string;

/** A package's words, in the language of the translator. */
export function packageTexts(t: PackagesTranslator, pkg: PackageDefinition): PackageTexts {
  const base = `items.${pkg.key}`;
  return {
    name: t(`${base}.name`),
    tableName: t(`${base}.tableName`),
    priceNote: t(`${base}.priceNote`),
    summary: t(`${base}.summary`),
    includes: pkg.includes.map((id) => t(`${base}.includes.${id}`)),
    valueNote: pkg.hasValueNote ? t(`${base}.valueNote`, PACKAGE_TEXT_VALUES) : undefined,
    badge: pkg.hasBadge ? t(`${base}.badge`) : undefined,
    ctaLabel: t(`${base}.cta`),
  };
}
