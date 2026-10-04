"use client";

import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { CheckIcon, WalletIcon } from "@/components/icons";
import { PACKAGES, PRICE_FOOTNOTE } from "@/lib/packages";
import { formatSek } from "@/lib/pricing";

/** The landing page's price list — the same packages /buy sells (lib/packages.ts). Buying happens on /buy. */
export function PricingSection() {
  return (
    <section id="priser" className="relative scroll-mt-24 bg-ka-cream">
      <div className={`${LANDING_CONTAINER} py-20 lg:py-28`}>
        <SectionIntro
          icon={WalletIcon}
          label="Priser"
          title="Tryggheten kostar 499 kr"
          description="Du betalar en gång per bostad. Inga abonnemang och ingen bindningstid."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PACKAGES.map((pkg, i) => (
            <Reveal key={pkg.key} variant="up" delay={i * 90} className="h-full">
              <div
                className={`relative flex h-full flex-col rounded-[22px] p-7 sm:p-8 ${
                  pkg.highlighted
                    ? "bg-ka-green-950 text-white shadow-[0_40px_80px_-40px_rgba(12,42,31,0.9)]"
                    : "border border-ka-line bg-white text-ka-ink shadow-[0_18px_40px_-32px_rgba(15,31,24,0.45)]"
                }`}
              >
                {pkg.badge && (
                  <span className="absolute -top-3 left-7 rounded-full bg-ka-mint px-3 py-1 text-xs font-bold text-ka-green-950 sm:left-8">
                    {pkg.badge}
                  </span>
                )}
                <h3 className="text-[19px] font-bold">{pkg.name}</h3>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-display text-[46px] font-bold leading-none tracking-tight">{formatSek(pkg.price)}</span>
                  <span className={`text-base font-semibold ${pkg.highlighted ? "text-white/80" : "text-ka-muted"}`}>kr</span>
                  <span className={`ml-1 text-sm ${pkg.highlighted ? "text-white/55" : "text-ka-muted"}`}>· {pkg.priceNote}</span>
                </p>
                <p className={`mt-4 text-[15px] leading-relaxed ${pkg.highlighted ? "text-white/80" : "text-ka-muted"}`}>
                  {pkg.summary}
                </p>
                <ul className={`mt-5 flex flex-col gap-2.5 border-t pt-5 ${pkg.highlighted ? "border-white/15" : "border-ka-line"}`}>
                  {pkg.includes.map((item) => (
                    <li
                      key={item}
                      className={`flex items-start gap-2.5 text-[14.5px] ${pkg.highlighted ? "text-white/90" : "text-ka-text"}`}
                    >
                      <CheckIcon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${pkg.highlighted ? "text-ka-mint" : "text-ka-green-700"}`}
                        strokeWidth={2.4}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                {pkg.valueNote && (
                  <p className={`mt-5 text-[13.5px] font-semibold ${pkg.highlighted ? "text-ka-mint" : "text-ka-green-700"}`}>
                    {pkg.valueNote}
                  </p>
                )}
                <div className="mt-auto pt-7">
                  <Link
                    href="/buy"
                    className={`inline-flex w-full items-center justify-center rounded-[12px] px-5 py-3.5 text-[15px] font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                      pkg.highlighted
                        ? "bg-ka-cream text-ka-green-950 hover:bg-white"
                        : "border-[1.5px] border-ka-green-900/30 text-ka-green-900 hover:border-ka-green-900 hover:bg-ka-green-900 hover:text-white"
                    }`}
                  >
                    {pkg.ctaLabel}
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 text-xs text-ka-muted">{PRICE_FOOTNOTE}</p>
      </div>
    </section>
  );
}
