"use client";

import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { SectionBackground } from "@/components/SectionBackground";
import { BrfAnalysis } from "@/components/report/BrfAnalysis";
import { ArrowRightIcon, ShieldIcon } from "@/components/icons";
import { EMPTY_BRF_FIGURES } from "@/lib/brf/figures";
import { interpretBrf } from "@/lib/brf/interpret";
import { BRF_REVIEW_PROMISE } from "@/lib/packages";

/**
 * The example report: the real BRF chapter component, rendered with a made-up
 * association, so what a visitor sees is exactly what a customer gets — and
 * clearly marked as an example. (The old screenshot showed a score ring the
 * product no longer has.)
 */
const EXAMPLE_FIGURES = {
  ...EMPTY_BRF_FIGURES,
  fiscalYear: 2025,
  annualFeePerSqm: 742,
  debtPerSqmBr: 6_240,
  debtPerSqmTotal: 5_980,
  savingsPerSqm: 212,
  interestSensitivityPct: 7.9,
  energyCostPerSqm: 204,
  feeShareOfRevenuePct: 91,
  numberOfApartments: 48,
  isGenuine: true,
  landTenure: "owned" as const,
  hasMaintenancePlan: true,
  pipesPlannedYear: 2028,
  feeChangePct: 5,
  feeChangeEffective: "1 januari 2027",
  expertComment:
    "Föreningen har en normal skuldsättning och ett sparande som täcker löpande underhåll. Stambytet 2028 ska enligt styrelsen finansieras med sparade medel och den beslutade avgiftshöjningen.",
};

const EXAMPLE_READING = interpretBrf(EXAMPLE_FIGURES, { livingAreaM2: 64, monthlyFeeSek: 3_950, buildingYear: 1962 }, new Date("2026-10-01T12:00:00Z"));

export function ExampleReportSection() {
  return (
    <section id="example-report" className="relative scroll-mt-24">
      <SectionBackground src="/report-blueprint-picture.png" />
      <div className="relative mx-auto w-full max-w-[1400px] px-6 py-20">
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-14">
          <Reveal variant="left" className="w-full lg:w-[58%]">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#FBF9F4] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between border-b border-black/10 bg-[#0E2B1F] px-5 py-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D8CBA3]">Köpanalys · Bostadsrättsförening</span>
                <span className="rounded-full bg-[#D8B563]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#D8B563]">
                  Exempel · påhittade siffror
                </span>
              </div>
              <div className="relative max-h-[560px] overflow-hidden px-5 pb-10 pt-5 sm:px-8" aria-label="Exempel på BRF-kapitlet i en rapport">
                <p className="mb-4 text-[15px] leading-relaxed text-[#2A2820]">Bostaden tillhör Brf Exempelgården.</p>
                <BrfAnalysis
                  state={{ kind: "published", reading: EXAMPLE_READING, publishedAt: "2026-10-01T12:00:00Z", update: null }}
                  associationName="Brf Exempelgården"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#FBF9F4] to-transparent" />
              </div>
            </div>
          </Reveal>

          <Reveal variant="right" className="w-full lg:w-[42%]">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-green-500/25 bg-green-500/10">
              <ShieldIcon className="h-6 w-6 text-green-400" />
            </span>
            <p className="mt-5 text-sm font-semibold text-green-400">Exempelrapport</p>
            <h2 className="mt-2 text-[32px] font-bold leading-tight tracking-tight sm:text-[36px]">
              Föreningens ekonomi i klartext
            </h2>
            <p className="mt-3 max-w-[440px] text-[15px] leading-relaxed text-neutral-400">
              Varje nyckeltal i årsredovisningen förklaras, jämförs med vad som brukar räknas som lågt och högt, och räknas om
              till vad det betyder för dig i kronor. {BRF_REVIEW_PROMISE}
            </p>
            <p className="mt-3 max-w-[440px] text-[13px] leading-relaxed text-neutral-500">
              Utöver BRF-analysen innehåller rapporten området, möjliga risker och frågorna att ställa till mäklaren och
              föreningen.
            </p>

            <Link
              href="/#priser"
              className="mt-8 inline-flex items-center gap-2.5 rounded-[10px] bg-green-600 px-6 py-3 text-[15px] font-semibold text-white transition hover:scale-[1.02] hover:bg-green-500 active:scale-[0.99]"
            >
              Se priserna
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
