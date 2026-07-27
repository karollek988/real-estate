"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { AnalysisBalanceCard } from "@/components/dashboard/buy/AnalysisBalanceCard";
import { InfoCard } from "@/components/dashboard/buy/InfoCard";
import { PremiumAnalysisCard } from "@/components/dashboard/buy/PremiumAnalysisCard";
import { PlanCard } from "@/components/dashboard/buy/PlanCard";
import { TrustStrip } from "@/components/dashboard/buy/TrustStrip";
import { PaymentMethodsCard } from "@/components/dashboard/buy/PaymentMethodsCard";
import { ClipboardIcon, TrendingUpIcon, ArrowRightIcon, CrownIcon, CreditCardIcon } from "@/components/icons";
import { PREMIUM_ANALYSIS_PRICE_SEK, PREMIUM_SUBSCRIPTION_PRICE_SEK, ULTRA_SUBSCRIPTION_PRICE_SEK } from "@/lib/pricing";

const ULTRA_ENABLED = false;

const PLANS = [
  {
    eyebrow: "Basic",
    title: "Basic",
    description: "Ingår för alla konton. Testa värdet innan du köper din första analys.",
    price: 0,
    features: [
      "3 gratis Decision Previews/månad",
      "Köp Premium Decision Analyses styckvis",
      "Samma kompletta analys vid varje köp",
    ],
    highlighted: false,
    hidden: false,
    priceKey: null as string | null,
  },
  {
    eyebrow: "Premium",
    title: "Premium",
    description: "För dig som analyserar flera bostäder och vill ha alla premiumverktyg.",
    price: PREMIUM_SUBSCRIPTION_PRICE_SEK,
    features: [
      "15 Premium Decision Analyses/månad",
      "Besiktningshjälp (Inspection Assistant)",
      "Sparade analyser",
      "Bevakningar",
      "Kommande premiumverktyg",
    ],
    highlighted: true,
    badge: "Populärast",
    hidden: false,
    priceKey: "premium_monthly" as string,
  },
  {
    eyebrow: "Ultra",
    title: "Ultra",
    description: "För dig som vill ha maximalt antal analyser och alltid ligga steget före.",
    price: ULTRA_SUBSCRIPTION_PRICE_SEK,
    features: [
      "30 Premium Decision Analyses/månad",
      "Allt i Premium",
      "Prioriterad support",
      "Högre gränser",
      "Tidig tillgång till nya funktioner",
    ],
    highlighted: false,
    hidden: !ULTRA_ENABLED,
    priceKey: "ultra_monthly" as string,
  },
];

const VISIBLE_PLANS = PLANS.filter((plan) => !plan.hidden);

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

interface SubscriptionSummary {
  status: string | null;
  tier: string | null;
  currentPeriodEnd: string | null;
}

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
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8 lg:flex-row">
      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col gap-10">
        <div className="dash-enter" style={stagger(0)}>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
            Prenumerationer
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
            Hantera ditt abonnemang, se ditt Decision Analysis-saldo och köp fler analyser
            eller ett paket.
          </p>
        </div>

        <section
          className="dash-enter rounded-2xl border border-green-500/20 bg-green-500/[0.04] p-5 backdrop-blur-xl"
          style={stagger(1)}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
              <CrownIcon className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-green-300">Ditt abonnemang</h2>
          </div>

          {subscription === null ? (
            <p className="mt-3 text-sm text-neutral-400">Laddar...</p>
          ) : subscription.tier ? (
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
          ) : (
            <p className="mt-3 text-sm text-neutral-400">
              Du har inget aktivt abonnemang. Välj ett paket nedan för fler analyser varje
              månad.
            </p>
          )}
        </section>

        <section className="dash-enter" style={stagger(2)}>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Köp enskild beslutsanalys
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            En analysnivå, inga kompromisser. Du får alltid hela beslutsunderlaget.
          </p>
          <div className="mt-5">
            <PremiumAnalysisCard price={PREMIUM_ANALYSIS_PRICE_SEK} />
          </div>
        </section>

        <section className="dash-enter" style={stagger(3)}>
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Uppgraderingsalternativ
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Paketen ändrar aldrig analysens kvalitet — de ger dig fler Premium Decision
            Analyses varje månad plus premiumfunktioner.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {VISIBLE_PLANS.map(({ hidden: _hidden, ...plan }) => (
              <PlanCard key={plan.title} {...plan} />
            ))}
          </div>
        </section>

        <div className="dash-enter" style={stagger(4)}>
          <TrustStrip />
        </div>
      </div>

      {/* Right column */}
      <aside className="dash-enter flex w-full shrink-0 flex-col gap-5 lg:w-[300px]" style={stagger(2)}>
        <AnalysisBalanceCard />

        <InfoCard icon={<ClipboardIcon />} title="Vad är en Premium Decision Analysis?">
          Det kompletta beslutsunderlaget för en specifik bostad: prisbild, jämförbara
          försäljningar, förening, område, risker och en slutlig rekommendation — innan du
          lägger bud.
          <button
            type="button"
            className="mt-3 flex items-center gap-1 text-sm font-medium text-green-400 transition hover:text-green-300"
          >
            Läs mer om analysen
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        </InfoCard>

        <InfoCard icon={<TrendingUpIcon />} title="Varför köpa paket?">
          <ul className="flex flex-col gap-2">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green-400" />
              Spara upp till 40% jämfört med enskilda analyser
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green-400" />
              Samma kompletta analys — bara fler av dem
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green-400" />
              Tillgång till premiumfunktioner
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green-400" />
              Avsluta när du vill, ingen bindningstid
            </li>
          </ul>
        </InfoCard>

        <PaymentMethodsCard />
      </aside>
    </div>
  );
}
