"use client";

import { useRef } from "react";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { SectionBackground } from "@/components/SectionBackground";
import { LANDING_CONTAINER } from "@/components/landing/container";
import { ROUTES } from "@/components/site/navigation";
import { BrfAnalysis } from "@/components/report/BrfAnalysis";
import {
  ArrowRightIcon,
  BuildingIcon,
  ClipboardIcon,
  CloseIcon,
  CraneIcon,
  FileTextIcon,
  HouseIcon,
  MapPinIcon,
  ShieldIcon,
  WalletIcon,
} from "@/components/icons";
import { EMPTY_BRF_FIGURES } from "@/lib/brf/figures";
import { interpretBrf } from "@/lib/brf/interpret";
import { BRF_REVIEW_PROMISE, HOUSING_COST_LIVE } from "@/lib/packages";

/**
 * The example report: the real BRF chapter component, rendered with a made-up
 * association, so what a visitor sees is exactly what a customer gets — and
 * clearly marked as an example. Next to it, the report's table of contents.
 * Used on the landing page and on /priser.
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

/** The chapters of a full report (app/report/page.tsx FullReportBody), in order. */
const REPORT_CHAPTERS = [
  { icon: FileTextIcon, title: "Sammanfattning" },
  { icon: HouseIcon, title: "Fastighetsinformation" },
  { icon: WalletIcon, title: "Boendekalkyl", soon: !HOUSING_COST_LIVE },
  { icon: BuildingIcon, title: "Bostadsrättsförening" },
  { icon: MapPinIcon, title: "Områdesanalys" },
  { icon: ShieldIcon, title: "Möjliga risker" },
  { icon: CraneIcon, title: "Framtidsutsikter" },
  { icon: ClipboardIcon, title: "Frågor inför visningen" },
];

function ExampleChapter() {
  return (
    <>
      <p className="mb-4 text-[15px] leading-relaxed text-[#2A2820]">Bostaden tillhör Brf Exempelgården.</p>
      <BrfAnalysis
        state={{ kind: "published", reading: EXAMPLE_READING, publishedAt: "2026-10-01T12:00:00Z", update: null }}
        associationName="Brf Exempelgården"
      />
    </>
  );
}

function ReportChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/10 bg-[#0E2B1F] px-5 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D8CBA3]">Köpanalys · Bostadsrättsförening</span>
      {children}
    </div>
  );
}

const EXAMPLE_BADGE = (
  <span className="rounded-full bg-[#D8B563]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#D8B563]">Exempel · påhittade siffror</span>
);

export function ExampleReportSection() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <section
      id="exempelrapport"
      aria-labelledby="exempelrapport-title"
      className="relative scroll-mt-24 overflow-hidden bg-ka-green-950 text-white"
    >
      <SectionBackground src="/report-blueprint-picture.png" />
      <div className={`relative ${LANDING_CONTAINER} py-20 lg:py-28`}>
        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
          <Reveal variant="left" className="w-full lg:w-[56%]">
            <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#FBF9F4] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
              <ReportChrome>{EXAMPLE_BADGE}</ReportChrome>
              <div className="relative max-h-[520px] overflow-hidden px-5 pb-10 pt-5 sm:px-8" aria-hidden>
                <ExampleChapter />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#FBF9F4] via-[#FBF9F4]/85 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => dialogRef.current?.showModal()}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ka-green-900 px-5 py-3 text-[14.5px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(12,42,31,0.9)] transition hover:-translate-y-0.5 hover:bg-ka-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2"
                >
                  <FileTextIcon className="h-[18px] w-[18px]" />
                  Läs hela exempelkapitlet
                </button>
              </div>
            </div>
          </Reveal>

          <Reveal variant="right" className="w-full lg:w-[44%]">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-mint">
              <FileTextIcon className="h-4 w-4" />
              Exempelrapport
            </p>
            <h2 id="exempelrapport-title" className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.015em] sm:text-[44px]">
              Se vad du får innan du köper
            </h2>
            <p className="mt-4 max-w-[480px] text-[16px] leading-relaxed text-white/75 sm:text-[17px]">
              Föreningens ekonomi i klartext: varje nyckeltal förklaras, jämförs med vad som brukar räknas som lågt och högt
              och räknas om till vad det betyder för dig i kronor. {BRF_REVIEW_PROMISE}
            </p>

            <div className="mt-7 rounded-[18px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/55">Rapporten innehåller</p>
              <ol className="mt-3 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
                {REPORT_CHAPTERS.map(({ icon: Icon, title, soon }) => (
                  <li key={title} className="flex items-center gap-2.5 text-[14.5px] text-white/85">
                    <Icon className="h-[18px] w-[18px] shrink-0 text-ka-mint" />
                    <span>
                      {title}
                      {soon && <span className="ml-1.5 text-[12px] text-white/50">(lanseras snart)</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <Link
                href={ROUTES.skapaAnalys}
                className="group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[12px] bg-ka-cream px-6 text-[15.5px] font-semibold text-ka-green-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white"
              >
                Skapa analys
                <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href={ROUTES.priser}
                className="inline-flex items-center justify-center gap-2 text-[15.5px] font-semibold text-ka-mint underline-offset-4 transition hover:text-white hover:underline"
              >
                Se priserna
              </Link>
            </div>
          </Reveal>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-label="Exempel på BRF-kapitlet i en rapport"
        onClick={(e) => {
          // A click on the backdrop lands on the dialog element itself.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto max-h-[min(88vh,900px)] w-[min(820px,calc(100vw-24px))] overflow-hidden rounded-[22px] bg-[#FBF9F4] p-0 text-ka-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[min(88vh,900px)] flex-col">
          <ReportChrome>
            <span className="flex items-center gap-3">
              {EXAMPLE_BADGE}
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Stäng exemplet"
                autoFocus
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#D8CBA3] transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8CBA3]"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </span>
          </ReportChrome>
          <div className="overflow-y-auto overscroll-contain px-5 pb-10 pt-5 sm:px-8">
            <ExampleChapter />
          </div>
        </div>
      </dialog>
    </section>
  );
}
