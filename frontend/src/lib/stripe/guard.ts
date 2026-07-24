import { SUBSCRIPTION_TIER, type SubscriptionTier } from "./prices";

export interface ProfileSubscription {
  subscription_status: string | null;
  subscription_tier: string | null;
  subscription_end: string | null;
  current_period_end: string | null;
}

export function isFree(profile: ProfileSubscription | null | undefined): boolean {
  if (!profile) return true;
  if (profile.subscription_status !== "active") return true;
  if (!profile.subscription_tier) return true;
  return false;
}

export function isPremium(profile: ProfileSubscription | null | undefined): boolean {
  if (!profile) return false;
  if (profile.subscription_status !== "active") return false;
  return profile.subscription_tier === SUBSCRIPTION_TIER.PREMIUM;
}

export function isUltra(profile: ProfileSubscription | null | undefined): boolean {
  if (!profile) return false;
  if (profile.subscription_status !== "active") return false;
  return profile.subscription_tier === SUBSCRIPTION_TIER.ULTRA;
}

export function hasActiveSubscription(profile: ProfileSubscription | null | undefined): boolean {
  if (!profile) return false;
  if (profile.subscription_status !== "active") return false;
  if (!profile.subscription_tier) return false;
  return true;
}

export function getSubscriptionTier(profile: ProfileSubscription | null | undefined): SubscriptionTier {
  if (!profile || !hasActiveSubscription(profile)) return SUBSCRIPTION_TIER.FREE;
  if (profile.subscription_tier === SUBSCRIPTION_TIER.ULTRA) return SUBSCRIPTION_TIER.ULTRA;
  if (profile.subscription_tier === SUBSCRIPTION_TIER.PREMIUM) return SUBSCRIPTION_TIER.PREMIUM;
  return SUBSCRIPTION_TIER.FREE;
}

export function hasMinimumTier(
  profile: ProfileSubscription | null | undefined,
  required: SubscriptionTier
): boolean {
  const current = getSubscriptionTier(profile);

  if (required === SUBSCRIPTION_TIER.FREE) return true;
  if (required === SUBSCRIPTION_TIER.PREMIUM) {
    return current === SUBSCRIPTION_TIER.PREMIUM || current === SUBSCRIPTION_TIER.ULTRA;
  }
  if (required === SUBSCRIPTION_TIER.ULTRA) {
    return current === SUBSCRIPTION_TIER.ULTRA;
  }

  return false;
}
