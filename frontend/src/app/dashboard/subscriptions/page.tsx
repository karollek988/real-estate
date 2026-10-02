"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { AnalysisBalanceCard } from "@/components/dashboard/buy/AnalysisBalanceCard";
import { ArrowRightIcon, CrownIcon, CreditCardIcon } from "@/components/icons";

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

interface SubscriptionSummary {
  status: string | null;
  tier: string | null;
  currentPeriodEnd: string | null;
}

// The page's route is unchanged, but subscriptions are no longer sold: this is
// the account's balance plus a way to the buy page. The subscription section
// below only shows for an account that already has one from before, so it can
// still cancel it.
export default function SubscriptionsPage() {
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/summary");
      if (res.ok) {
        const data = await res.json();
        setSubscription({
          status: data.subscriptionStatus,
          tier: data.subscriptionTier,
          currentPeriodEnd: data.currentPeriodEnd,
        });
      }
    } catch {
      // Silently fail — subscription info is not critical for page load
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  async function handleManageSubscription() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setPortalError(data?.error?.message ?? "Kunde inte öppna betalningsportalen.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setPortalError("Något gick fel. Försök igen.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="dash-enter" style={stagger(0)}>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">Köp &amp; saldo</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Se hur många analyser du har kvar och vad som finns på kontot. Köp en Områdesanalys eller ett
          Trygghetspaket när du behöver fler.
        </p>
      </div>

      <div className="dash-enter" style={stagger(1)}>
        <AnalysisBalanceCard />
      </div>

      <div className="dash-enter" style={stagger(2)}>
        <Link
          href="/buy"
          className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-6 py-3 text-sm font-semibold text-[#06120C] transition-all duration-200 hover:bg-green-400"
        >
          Se paketen
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      {subscription?.tier && (
        <section
          className="dash-enter rounded-2xl border border-green-500/20 bg-green-500/[0.04] p-5 backdrop-blur-xl"
          style={stagger(3)}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
              <CrownIcon className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-green-300">Ditt abonnemang</h2>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-neutral-300">
              <span className="font-medium text-white">
                {subscription.tier === "ultra" ? "Ultra" : "Premium"}
              </span>
              <span className="ml-2 text-xs uppercase tracking-wide text-green-400">
                {subscription.status === "active"
                  ? "Aktivt"
                  : subscription.status === "past_due"
                    ? "Förfallen"
                    : "Avslutat"}
              </span>
            </p>
            {subscription.currentPeriodEnd && (
              <p className="text-sm text-neutral-400">
                Nästa betalning: {new Date(subscription.currentPeriodEnd).toLocaleDateString("sv-SE")}
              </p>
            )}
            <p className="text-sm text-neutral-400">
              Vi säljer inga nya abonnemang. Du kan avsluta det här när du vill.
            </p>
            {portalError && <p className="text-sm text-red-400">{portalError}</p>}
            <div className="mt-2">
              <Button
                variant="secondary"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="flex items-center gap-2"
              >
                <CreditCardIcon className="h-4 w-4" />
                {portalLoading ? "Öppnar portal..." : "Hantera abonnemang"}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
