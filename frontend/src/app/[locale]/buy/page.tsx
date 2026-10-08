"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthModal } from "@/components/AuthModal";
import { BuyHero } from "@/components/buy/BuyHero";
import { PackageCard } from "@/components/buy/PackageCard";
import { PackageContents } from "@/components/buy/PackageContents";
import { AnalysisBalanceCard } from "@/components/dashboard/buy/AnalysisBalanceCard";
import { BuyPaymentMethodsCard } from "@/components/buy/BuyPaymentMethodsCard";
import { ArrowRightIcon, CheckIcon, WarningIcon } from "@/components/icons";
import { PACKAGES, packageTexts } from "@/lib/packages";

/** The three steps. Their words: buy.steps.<id>.title / .text */
const STEP_IDS = ["pay", "enter", "receive"] as const;

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

function BuyPageContent() {
  const t = useTranslations("buy");
  const tPackages = useTranslations("packages");
  const searchParams = useSearchParams();
  // Typed nullable since src/pages/ (the admin portal) exists; never null in the App Router.
  const checkout = searchParams?.get("checkout") ?? null;
  const [authOpen, setAuthOpen] = useState(false);

  const requireAuth = () => setAuthOpen(true);

  return (
    <div className="min-h-screen bg-ka-cream text-ka-ink">
      <SiteHeader />

      <div className="relative">
        <main className="relative mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Main column */}
            <div className="flex min-w-0 flex-1 flex-col gap-12">
              {checkout === "success" && (
                <div className="dash-enter flex items-center gap-3 rounded-2xl border border-ka-green-700/30 bg-ka-sage/40 p-4 text-sm text-ka-green-700">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ka-sage">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  {t("checkout.success")}
                </div>
              )}
              {checkout === "cancel" && (
                <div className="dash-enter flex items-center gap-3 rounded-2xl border border-ka-amber-300 bg-ka-amber-100 p-4 text-sm text-ka-amber-700">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ka-amber-100">
                    <WarningIcon className="h-4 w-4" />
                  </span>
                  {t("checkout.cancel")}
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
                <div className="rounded-2xl border border-ka-line-strong bg-ka-cream p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ka-muted">{t("free.label")}</p>
                  <p className="mt-1 text-[15px] text-ka-text">{t("free.text")}</p>
                </div>
                <ArrowRightIcon className="mx-auto h-5 w-5 rotate-90 text-ka-muted sm:rotate-0" />
                <div className="rounded-2xl border border-ka-green-700/30 bg-ka-sage/40 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ka-green-700">{t("paid.label")}</p>
                  <p className="mt-1 text-[15px] text-ka-ink">{t("paid.text")}</p>
                </div>
              </div>

              <section className="dash-enter" style={stagger(2)}>
                <h2 className="text-2xl font-bold tracking-tight text-ka-ink">{t("choose.title")}</h2>
                <p className="mt-1 text-sm text-ka-muted">{t("choose.text")}</p>
                <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {PACKAGES.map((pkg) => {
                    const texts = packageTexts(tPackages, pkg);
                    return (
                      <PackageCard
                        key={pkg.key}
                        name={texts.name}
                        price={pkg.price}
                        priceNote={texts.priceNote}
                        summary={texts.summary}
                        includes={texts.includes}
                        valueNote={texts.valueNote}
                        badge={texts.badge}
                        highlighted={pkg.highlighted}
                        ctaLabel={texts.ctaLabel}
                        priceKey={pkg.key}
                        acceptsDiscountCode={pkg.acceptsDiscountCode}
                        onRequireAuth={requireAuth}
                      />
                    );
                  })}
                </div>
              </section>

              <div className="dash-enter" style={stagger(3)}>
                <PackageContents />
              </div>

              <section className="dash-enter" style={stagger(4)}>
                <h2 className="text-2xl font-bold tracking-tight text-ka-ink">{t("steps.title")}</h2>
                <ol className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                  {STEP_IDS.map((id, index) => (
                    <li key={id} className="flex gap-4 rounded-2xl border border-ka-line-strong bg-white p-5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ka-sage/60 text-sm font-semibold text-ka-green-700">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-ka-ink">{t(`steps.${id}.title`)}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-ka-muted">
                          {id === "receive"
                            ? t("steps.receive.text", { areaPromise: tPackages("areaPromise"), reviewPromise: tPackages("reviewPromise") })
                            : t(`steps.${id}.text`)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <p className="max-w-3xl text-xs leading-relaxed text-ka-muted">
                {t("footnote", { priceFootnote: tPackages("priceFootnote") })}
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
