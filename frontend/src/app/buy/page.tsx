"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthModal } from "@/components/AuthModal";
import { BuyHero } from "@/components/buy/BuyHero";
import { PackageCard } from "@/components/buy/PackageCard";
import { PackageContents } from "@/components/buy/PackageContents";
import { AnalysisBalanceCard } from "@/components/dashboard/buy/AnalysisBalanceCard";
import { BuyPaymentMethodsCard } from "@/components/buy/BuyPaymentMethodsCard";
import { ArrowRightIcon, CheckIcon, WarningIcon } from "@/components/icons";
import { AREA_ANALYSIS_PROMISE, BRF_REVIEW_PROMISE, PACKAGES, PRICE_FOOTNOTE } from "@/lib/packages";

const STEPS = [
  { title: "Betala en gång", text: "Du betalar med kort. Ingen bindningstid och inget abonnemang." },
  {
    title: "Ange bostaden",
    text: "Ladda upp en skärmdump av annonsen för ett Trygghetspaket, eller skriv in en adress för en Områdesanalys.",
  },
  {
    title: "Få din analys",
    text: `${AREA_ANALYSIS_PROMISE} ${BRF_REVIEW_PROMISE} Rapporten kan laddas ner som PDF.`,
  },
];

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

function BuyPageContent() {
  const searchParams = useSearchParams();
  // Typed nullable since src/pages/ (the admin portal) exists; never null in the App Router.
  const checkout = searchParams?.get("checkout") ?? null;
  const [authOpen, setAuthOpen] = useState(false);

  const requireAuth = () => setAuthOpen(true);

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
            <div className="flex min-w-0 flex-1 flex-col gap-12">
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

              {/* What is free, and what the payment is for */}
              <div
                className="dash-enter grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"
                style={stagger(1)}
              >
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Gratis · kommer snart</p>
                  <p className="mt-1 text-[15px] text-neutral-200">Karta med annonser och kommunikation</p>
                </div>
                <ArrowRightIcon className="mx-auto h-5 w-5 rotate-90 text-neutral-500 sm:rotate-0" />
                <div className="rounded-2xl border border-green-500/30 bg-green-500/[0.08] p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-400">Betalt</p>
                  <p className="mt-1 text-[15px] text-white">Områdesanalys eller Trygghetspaket för dig som ska köpa</p>
                </div>
              </div>

              <section className="dash-enter" style={stagger(2)}>
                <h2 className="text-2xl font-bold tracking-tight text-white">Välj paket</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Alla priser är engångsbetalningar inklusive moms.
                </p>
                <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {PACKAGES.map((pkg) => (
                    <PackageCard
                      key={pkg.key}
                      name={pkg.name}
                      price={pkg.price}
                      priceNote={pkg.priceNote}
                      summary={pkg.summary}
                      includes={pkg.includes}
                      valueNote={pkg.valueNote}
                      badge={pkg.badge}
                      highlighted={pkg.highlighted}
                      ctaLabel={pkg.ctaLabel}
                      priceKey={pkg.key}
                      acceptsDiscountCode={pkg.acceptsDiscountCode}
                      onRequireAuth={requireAuth}
                    />
                  ))}
                </div>
              </section>

              <div className="dash-enter" style={stagger(3)}>
                <PackageContents />
              </div>

              <section className="dash-enter" style={stagger(4)}>
                <h2 className="text-2xl font-bold tracking-tight text-white">Så går det till</h2>
                <ol className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                  {STEPS.map((step, index) => (
                    <li key={step.title} className="flex gap-4 rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-400/10 text-sm font-semibold text-green-400">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-neutral-400">{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <p className="max-w-3xl text-xs leading-relaxed text-neutral-500">
                Priserna gäller engångsköp och anges i svenska kronor inklusive moms. {PRICE_FOOTNOTE} Analysen är ett
                beslutsunderlag och ersätter inte en besiktning eller en egen genomgång av föreningens
                handlingar.
              </p>
            </div>

            {/* Right column */}
            <aside
              className="dash-enter flex w-full shrink-0 flex-col gap-5 lg:w-[300px]"
              style={stagger(2)}
            >
              <AnalysisBalanceCard />
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
