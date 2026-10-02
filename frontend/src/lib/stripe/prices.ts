import { TRE_BOSTADER_COUNT } from "@/lib/pricing";

/**
 * What is sold: three one-time packages, each a Stripe Price (created once in
 * the Stripe Dashboard, id kept in an environment variable — a Price's amount
 * can't be edited, so a price change means a new Price and a new id; the SEK
 * amounts shown on the site live in lib/pricing.ts and must be changed
 * together with it).
 *
 * `credits` is what a completed purchase adds to the buyer's balance:
 * "full" credits pay for a Trygghetspaket analysis (the complete report of one
 * property), "area" credits for an Områdesanalys (the area chapter only).
 */
const ONE_TIME_PRODUCTS = {
  omradesanalys: {
    priceEnvVar: "STRIPE_PRICE_OMRADESANALYS",
    label: "Områdesanalys",
    credits: { full: 0, area: 1 },
  },
  trygghetspaket: {
    priceEnvVar: "STRIPE_PRICE_TRYGGHETSPAKET",
    label: "Trygghetspaketet",
    credits: { full: 1, area: 0 },
  },
  tre_bostader: {
    priceEnvVar: "STRIPE_PRICE_TRE_BOSTADER",
    label: "Tre bostäder",
    credits: { full: TRE_BOSTADER_COUNT, area: 0 },
  },
} as const;

export type OneTimePriceKey = keyof typeof ONE_TIME_PRODUCTS;

export interface PurchaseCredits {
  full: number;
  area: number;
}

export function isOneTimePriceKey(value: unknown): value is OneTimePriceKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ONE_TIME_PRODUCTS, value);
}

export function getOneTimeProduct(key: OneTimePriceKey): { label: string; credits: PurchaseCredits } {
  const { label, credits } = ONE_TIME_PRODUCTS[key];
  return { label, credits };
}

export function getPriceId(key: OneTimePriceKey): string {
  const { priceEnvVar } = ONE_TIME_PRODUCTS[key];
  const priceId = process.env[priceEnvVar];
  if (!priceId) {
    throw new Error(`Missing Stripe Price ID for "${key}". Set the ${priceEnvVar} environment variable.`);
  }
  return priceId;
}

/**
 * Subscriptions are no longer sold, and nothing creates a subscription
 * checkout. These two Price ids are kept only so the webhook can still
 * recognise a subscription that already exists in Stripe (see
 * getTierForPriceId) — remove them, and the subscription handling in
 * webhooks.ts, once no active subscription is left in the Stripe Dashboard.
 */
export type SubscriptionTier = "premium" | "ultra";

const LEGACY_SUBSCRIPTION_PRICE_ENV: Record<SubscriptionTier, string> = {
  premium: "STRIPE_PRICE_PREMIUM_MONTHLY",
  ultra: "STRIPE_PRICE_ULTRA_MONTHLY",
};

export function getTierForPriceId(priceId: string): SubscriptionTier | null {
  for (const [tier, envVar] of Object.entries(LEGACY_SUBSCRIPTION_PRICE_ENV) as [SubscriptionTier, string][]) {
    const configured = process.env[envVar];
    if (configured && configured === priceId) return tier;
  }
  return null;
}

/**
 * Discount codes: a code is good for one purchase of the product it was
 * issued for and is applied through a Stripe Coupon (50% off, duration
 * "once"), created once in the Stripe Dashboard and referenced by id — the
 * same way the Price ids above are. One coupon serves every product; it must
 * not be restricted to specific products in Stripe.
 */
export const DISCOUNT_CODE_KINDS = ["trygghetspaket", "omradesanalys"] as const;
export type DiscountCodeKind = (typeof DISCOUNT_CODE_KINDS)[number];

const DISCOUNT_COUPON_ENV_VAR = "STRIPE_COUPON_ANALYSIS_50OFF";

export function getCouponId(kind: DiscountCodeKind): string {
  const couponId = process.env[DISCOUNT_COUPON_ENV_VAR];
  if (!couponId) {
    throw new Error(`Missing Stripe Coupon ID for "${kind}". Set the ${DISCOUNT_COUPON_ENV_VAR} environment variable.`);
  }
  return couponId;
}
