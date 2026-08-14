export const SUBSCRIPTION_TIER = {
  FREE: "free",
  PREMIUM: "premium",
  ULTRA: "ultra",
} as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIER)[keyof typeof SUBSCRIPTION_TIER];

export interface ProductConfig {
  priceId: string;
  tier: SubscriptionTier;
  type: "subscription" | "one_time";
  label: string;
}

export function getProductConfig(): Record<string, ProductConfig> {
  return {
    premium_monthly: {
      priceId: process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? "",
      tier: SUBSCRIPTION_TIER.PREMIUM,
      type: "subscription",
      label: "Premium",
    },
    ultra_monthly: {
      priceId: process.env.STRIPE_PRICE_ULTRA_MONTHLY ?? "",
      tier: SUBSCRIPTION_TIER.ULTRA,
      type: "subscription",
      label: "Ultra",
    },
    premium_analysis: {
      priceId: process.env.STRIPE_PRICE_PREMIUM_ANALYSIS ?? "",
      tier: SUBSCRIPTION_TIER.PREMIUM,
      type: "one_time",
      label: "Premium Beslutsanalys",
    },
  };
}

export function getPriceId(key: keyof ReturnType<typeof getProductConfig>): string {
  const config = getProductConfig()[key];
  if (!config?.priceId) {
    throw new Error(`Missing Stripe Price ID for "${key}". Set STRIPE_PRICE_${key.toUpperCase()} environment variable.`);
  }
  return config.priceId;
}

export function getTierForPriceId(priceId: string): SubscriptionTier | null {
  for (const config of Object.values(getProductConfig())) {
    if (config.priceId === priceId) {
      return config.tier;
    }
  }
  return null;
}

export function isSubscriptionPriceId(priceId: string): boolean {
  for (const config of Object.values(getProductConfig())) {
    if (config.priceId === priceId) {
      return config.type === "subscription";
    }
  }
  return false;
}

// Stripe Coupon ids for the First 100 Users campaign — created once in the
// Stripe Dashboard (50% off, duration "once"), referenced by id here the
// same way price ids are above.
const DISCOUNT_CODE_KIND_TO_COUPON_ENV = {
  premium_analysis: "STRIPE_COUPON_ANALYSIS_50OFF",
  premium_subscription: "STRIPE_COUPON_SUBSCRIPTION_50OFF",
} as const;

export type DiscountCodeKind = keyof typeof DISCOUNT_CODE_KIND_TO_COUPON_ENV;

export function getCouponId(kind: DiscountCodeKind): string {
  const envVar = DISCOUNT_CODE_KIND_TO_COUPON_ENV[kind];
  const couponId = process.env[envVar];
  if (!couponId) {
    throw new Error(`Missing Stripe Coupon ID for "${kind}". Set ${envVar} environment variable.`);
  }
  return couponId;
}
