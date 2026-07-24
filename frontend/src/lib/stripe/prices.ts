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
