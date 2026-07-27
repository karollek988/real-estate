"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CrownIcon, ChevronRightIcon, BadgeCheckIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isDevAdmin } from "@/lib/auth/devAdmin";

export function PremiumPerksCard() {
  const { user } = useAuth();
  const devAdmin = isDevAdmin(user?.email);
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/summary");
      if (res.ok) {
        const data = await res.json();
        setSubscriptionTier(data.subscriptionTier);
        setSubscriptionStatus(data.subscriptionStatus);
      }
    } catch {
      // Ignore errors — card shows default state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (devAdmin) {
    return (
      <div className="card-lift rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-400/[0.07] to-transparent p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
            <BadgeCheckIcon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-amber-300">Premium aktiv · Dev</h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          Ditt lokala dev-konto har obegränsad tillgång till Premium Decision Analyses,
          besiktningshjälp och personliga bevakningar. Inget krävs för test.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-lift rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-400/[0.07] to-transparent p-5 backdrop-blur-xl">
        <p className="text-sm text-neutral-400">Laddar...</p>
      </div>
    );
  }

  if (subscriptionStatus === "active" && subscriptionTier) {
    const tierLabel = subscriptionTier === "ultra" ? "Ultra" : "Premium";
    return (
      <div className="card-lift rounded-2xl border border-green-400/20 bg-gradient-to-b from-green-400/[0.07] to-transparent p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-400/10 text-green-400">
            <BadgeCheckIcon className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-green-300">{tierLabel} aktiv</h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          Du har ett aktivt {tierLabel}-abonnemang med full tillgång till premiumfunktioner.
        </p>
        <Link
          href="/dashboard/settings"
          className="mt-3 flex items-center gap-1 text-sm font-medium text-green-400 transition hover:text-green-300"
        >
          Hantera abonnemang
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="card-lift rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-400/[0.07] to-transparent p-5 backdrop-blur-xl hover:border-amber-400/35">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
          <CrownIcon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold text-amber-300">Premium fördelar</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
        Som premium-medlem får du fler Premium Decision Analyses varje månad, plus tillgång
        till besiktningshjälp och personliga bevakningar.
      </p>
      <Link
        href="/buy"
        className="mt-3 flex items-center gap-1 text-sm font-medium text-green-400 transition hover:text-green-300"
      >
        Se alla fördelar
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
