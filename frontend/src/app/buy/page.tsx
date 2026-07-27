"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthModal } from "@/components/AuthModal";
import { InfoCard } from "@/components/dashboard/buy/InfoCard";
import { BuyHero } from "@/components/buy/BuyHero";
import { PremiumHighlightCard } from "@/components/buy/PremiumHighlightCard";
import { BuyPlanCard } from "@/components/buy/BuyPlanCard";
import { BuyBalanceCard } from "@/components/buy/BuyBalanceCard";
import { BuyPaymentMethodsCard } from "@/components/buy/BuyPaymentMethodsCard";
import { useAuth } from "@/lib/auth/AuthProvider";
import { GemIcon, TrendingUpIcon, ArrowRightIcon, CheckIcon, WarningIcon } from "@/components/icons";
import {
  PREMIUM_ANALYSIS_PRICE_SEK,
  PREMIUM_SUBSCRIPTION_PRICE_SEK,
  ULTRA_SUBSCRIPTION_PRICE_SEK,
} from "@/lib/pricing";

const ULTRA_ENABLED = false;

const PLANS = [
  {
    eyebrow: "Basic",
    title: "Basic",
    description: "Testa värdet innan du bestämmer dig.",
    price: 0,
    period: undefined as string | undefined,
    features: ["Begränsad analys", "Översiktlig prisbedömning", "Grundläggande områdesinfo"],
    ctaLabel: "Kom igång gratis",
    caption: undefined as string | undefined,
    highlighted: false,
    badge: undefined as string | undefined,
    hidden: false,
    priceKey: null as string | null,
  },
  {
    eyebrow: "Premium",
    title: "Premium",
    description: "För dig som analyserar flera bostäder.",
    price: PREMIUM_SUBSCRIPTION_PRICE_SEK,
    period: "mån",
    features: ["15 st Premium-analyser / månad", "Alla premiumfunktioner", "Prioriterad leverans"],
    ctaLabel: "Välj Premium",
    caption: "Spara upp till 40%",
    highlighted: true,
    badge: "Populärast",
    hidden: false,
    priceKey: "premium_monthly" as string | null,
  },
  {
    eyebrow: "Ultra",
    title: "Ultra",
    description: "För bostadsjägare och investerare.",
    price: ULTRA_SUBSCRIPTION_PRICE_SEK,
    period: "mån",
    features: ["Obegränsade Premium-analyser", "Tidiga marknadsinsikter", "Exklusiva analyser & nyheter"],
    ctaLabel: "Välj Ultra",
    caption: undefined as string | undefined,
    highlighted: false,
    badge: undefined as string | undefined,
    hidden: !ULTRA_ENABLED,
    priceKey: "ultra_monthly" as string | null,
  },
];

const VISIBLE_PLANS = PLANS.filter((plan) => !plan.hidden);

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

function BuyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const requireAuth = () => setAuthOpen(true);
  const handleFreeCta = () => {
    if (user) router.push("/dashboard");
    else setAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0A0F0D] text-white">
      <SiteHeader />

      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
          <Image src="/hero-background.png" alt="" fill priority className="object-cover object-top opacity-30" />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0A0F0D]/70 to-[#0A0F0D]" />
        </div>

        <main className="relative mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Main column */}
            <div className="flex min-w-0 flex-1 flex-col gap-10">
              {checkout === "success" && (
                <div className="dash-enter flex items-center gap-3 rounded-2xl border border-green-500/30 bg-green-500/[0.08] p-4 text-sm text-green-300">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/15">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  Ditt köp lyckades! Ditt saldo är uppdaterat och redo att användas.
                </div>
              )}
              {checkout === "cancel" && (
                <div className="dash-enter flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 text-sm text-amber-300">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                    <WarningIcon className="h-4 w-4" />
                  </span>
                  Betalningen avbröts. Inget drogs från ditt kort — försök gärna igen.
                </div>
              )}

              <div className="dash-enter" style={stagger(0)}>
                <BuyHero />
              </div>

              <div className="dash-enter" style={stagger(1)}>
                <PremiumHighlightCard price={PREMIUM_ANALYSIS_PRICE_SEK} onRequireAuth={requireAuth} />
              </div>

              <section className="dash-enter" style={stagger(2)}>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Välj paket som passar dig
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Samma höga analyskvalitet — välj det som passar din situation. Uppgradera när
                  du vill.
                </p>
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {VISIBLE_PLANS.map((plan) => (
                    <BuyPlanCard
                      key={plan.title}
                      {...plan}
                      onRequireAuth={requireAuth}
                      onFreeCta={plan.priceKey ? undefined : handleFreeCta}
                    />
                  ))}
                </div>
              </section>
            </div>

            {/* Right column */}
            <aside
              className="dash-enter flex w-full shrink-0 flex-col gap-5 lg:w-[300px]"
              style={stagger(2)}
            >
              <BuyBalanceCard />

              <InfoCard icon={<GemIcon />} title="Vad ingår i Premium Decision Analysis?">
                Ett komplett beslutsunderlag för en specifik bostad — innan du lägger bud.
                <ul className="mt-3 flex flex-col gap-2">
                  {[
                    "Marknadsvärde och prisjämförelse",
                    "Detaljerad områdesanalys",
                    "Djupgående BRF-analys",
                    "Riskbedömning och framtidsutsikter",
                    "Tydlig rekommendation (Köp / Avvakta)",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-neutral-300">
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href="/#example-report"
                  className="mt-4 flex items-center gap-1 text-sm font-medium text-green-400 transition hover:text-green-300"
                >
                  Se exempelrapport
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </a>
              </InfoCard>

              <InfoCard icon={<TrendingUpIcon />} title="Varför välja Köpanalys?">
                <ul className="flex flex-col gap-2">
                  {[
                    "Spara upp till 40% jämfört med enskilda analyser",
                    "Fatta beslut på fakta, inte magkänsla",
                    "Spara tid och minska risken",
                    "Hjälper dig förhandla ett bättre pris",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-neutral-300">
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </InfoCard>

              <BuyPaymentMethodsCard />
            </aside>
          </div>
        </main>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export default function BuyPage() {
  return (
    <Suspense fallback={null}>
      <BuyPageContent />
    </Suspense>
  );
}
