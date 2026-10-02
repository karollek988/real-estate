"use client";

import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { SectionIntro } from "@/components/SectionIntro";
import { CheckIcon, WalletIcon } from "@/components/icons";
import { PACKAGES, PRICE_FOOTNOTE } from "@/lib/packages";
import { formatSek } from "@/lib/pricing";

/** The landing page's price list — the same packages /buy sells (lib/packages.ts). Buying happens on /buy. */
export function PricingSection() {
  return (
    <section id="priser" className="relative scroll-mt-24">
      <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20">
        <SectionIntro
          icon={WalletIcon}
          label="Priser"
          title="Tryggheten kostar 499 kr"
          description="Du betalar en gång per bostad. Inga abonnemang och ingen bindningstid."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PACKAGES.map((pkg, i) => (
            <Reveal key={pkg.key} variant="up" delay={i * 90} className="h-full">
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-7 ${
                  pkg.highlighted ? "border-green-500/50 bg-green-500/[0.07]" : "border-white/10 bg-white/[0.03]"
                }`}
              >
                {pkg.badge && (
                  <span className="absolute -top-3 left-7 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-[#06120B]">
                    {pkg.badge}
                  </span>
                )}
                <h3 className="text-[18px] font-semibold">{pkg.name}</h3>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-[40px] font-bold tracking-tight">{formatSek(pkg.price)}</span>
                  <span className="text-base font-medium text-neutral-300">kr</span>
                  <span className="ml-1 text-sm text-neutral-500">· {pkg.priceNote}</span>
                </p>
                <p className="mt-3 text-[14.5px] leading-relaxed text-neutral-300">{pkg.summary}</p>
                <ul className="mt-5 flex flex-col gap-2.5 border-t border-white/10 pt-5">
                  {pkg.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[14px] text-neutral-200">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                {pkg.valueNote && <p className="mt-5 text-[13px] font-medium text-green-300">{pkg.valueNote}</p>}
                <div className="mt-auto pt-6">
                  <Link
                    href="/buy"
                    className={`inline-flex w-full items-center justify-center rounded-[10px] px-5 py-3 text-[15px] font-semibold transition ${
                      pkg.highlighted ? "bg-green-600 text-white hover:bg-green-500" : "border border-white/15 text-white hover:bg-white/[0.06]"
                    }`}
                  >
                    {pkg.ctaLabel}
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 text-xs text-neutral-500">{PRICE_FOOTNOTE}</p>
      </div>
    </section>
  );
}
