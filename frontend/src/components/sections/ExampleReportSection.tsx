"use client";

import { useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
import { HOUSING_COST_LIVE } from "@/lib/packages";
import { useTextKit } from "@/i18n/useTextKit";

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
  // the date of the fee increase and the expert's comment are text: they come from the messages (exampleReport.example)
};

/** The made-up association's reading, as the BRF chapter shows it. */
function useExampleReading() {
  const t = useTranslations("exampleReport.example");
  const kit = useTextKit();
  return useMemo(
    () =>
      interpretBrf(
        { ...EXAMPLE_FIGURES, feeChangeEffective: t("feeChangeEffective"), expertComment: t("expertComment") },
        { livingAreaM2: 64, monthlyFeeSek: 3_950, buildingYear: 1962 },
        kit,
        new Date("2026-10-01T12:00:00Z"),
      ),
    [t, kit],
  );
}

/** The chapters of a full report (app/report/page.tsx FullReportBody), in order. Their names: exampleReport.chapters.<id> */
const REPORT_CHAPTERS = [
  { icon: FileTextIcon, id: "summary" },
  { icon: HouseIcon, id: "property" },
  { icon: WalletIcon, id: "housingCost", soon: !HOUSING_COST_LIVE },
  { icon: BuildingIcon, id: "brf" },
  { icon: MapPinIcon, id: "area" },
  { icon: ShieldIcon, id: "risks" },
  { icon: CraneIcon, id: "outlook" },
  { icon: ClipboardIcon, id: "questions" },
] as const;

function ExampleChapter({ reading }: { reading: ReturnType<typeof interpretBrf> }) {
  const t = useTranslations("exampleReport.example");
  return (
    <>
      <p className="mb-4 text-[15px] leading-relaxed text-[#2A2820]">{t("belongs", { name: t("associationName") })}</p>
      <BrfAnalysis
        state={{ kind: "published", reading, publishedAt: "2026-10-01T12:00:00Z", update: null }}
        associationName={t("associationName")}
      />
    </>
  );
}

function ReportChrome({ children }: { children: React.ReactNode }) {
  const t = useTranslations("exampleReport");
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/10 bg-[#0E2B1F] px-5 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D8CBA3]">{t("chrome")}</span>
      {children}
    </div>
  );
}

function ExampleBadge() {
  const t = useTranslations("exampleReport");
  return <span className="rounded-full bg-[#D8B563]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#D8B563]">{t("badge")}</span>;
}

export function ExampleReportSection() {
  const t = useTranslations("exampleReport");
  const tPackages = useTranslations("packages");
  const reading = useExampleReading();
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
              <ReportChrome>
                <ExampleBadge />
              </ReportChrome>
              <div className="relative max-h-[520px] overflow-hidden px-5 pb-10 pt-5 sm:px-8" aria-hidden>
                <ExampleChapter reading={reading} />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#FBF9F4] via-[#FBF9F4]/85 to-transparent" />
              </div>
              <div className="absolute inset-x-0 bottom-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => dialogRef.current?.showModal()}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ka-green-900 px-5 py-3 text-[14.5px] font-semibold text-white shadow-[0_14px_30px_-12px_rgba(12,42,31,0.9)] transition hover:-translate-y-0.5 hover:bg-ka-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ka-green-700 focus-visible:ring-offset-2"
                >
                  <FileTextIcon className="h-[18px] w-[18px]" />
                  {t("open")}
                </button>
              </div>
            </div>
          </Reveal>

          <Reveal variant="right" className="w-full lg:w-[44%]">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-ka-mint">
              <FileTextIcon className="h-4 w-4" />
              {t("eyebrow")}
            </p>
            <h2 id="exempelrapport-title" className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.015em] sm:text-[44px]">
              {t("title")}
            </h2>
            <p className="mt-4 max-w-[480px] text-[16px] leading-relaxed text-white/75 sm:text-[17px]">
              {t("lead")} {tPackages("reviewPromise")}
            </p>

            <div className="mt-7 rounded-[18px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/55">{t("contents")}</p>
              <ol className="mt-3 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
                {REPORT_CHAPTERS.map((chapter) => {
                  const { icon: Icon, id } = chapter;
                  const soon = "soon" in chapter && chapter.soon;
                  return (
                  <li key={id} className="flex items-center gap-2.5 text-[14.5px] text-white/85">
                    <Icon className="h-[18px] w-[18px] shrink-0 text-ka-mint" />
                    <span>
                      {t(`chapters.${id}`)}
                      {soon && <span className="ml-1.5 text-[12px] text-white/50">{t("soon")}</span>}
                    </span>
                  </li>
                  );
                })}
              </ol>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <Link
                href={ROUTES.skapaAnalys}
                className="group inline-flex h-[52px] items-center justify-center gap-2.5 rounded-[12px] bg-ka-cream px-6 text-[15.5px] font-semibold text-ka-green-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white"
              >
                {t("createAnalysis")}
                <ArrowRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
              <Link
                href={ROUTES.priser}
                className="inline-flex items-center justify-center gap-2 text-[15.5px] font-semibold text-ka-mint underline-offset-4 transition hover:text-white hover:underline"
              >
                {t("prices")}
              </Link>
            </div>
          </Reveal>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-label={t("dialogLabel")}
        onClick={(e) => {
          // A click on the backdrop lands on the dialog element itself.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto max-h-[min(88vh,900px)] w-[min(820px,calc(100vw-24px))] overflow-hidden rounded-[22px] bg-[#FBF9F4] p-0 text-ka-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[min(88vh,900px)] flex-col">
          <ReportChrome>
            <span className="flex items-center gap-3">
              <ExampleBadge />
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label={t("close")}
                autoFocus
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#D8CBA3] transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8CBA3]"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </span>
          </ReportChrome>
          <div className="overflow-y-auto overscroll-contain px-5 pb-10 pt-5 sm:px-8">
            <ExampleChapter reading={reading} />
          </div>
        </div>
      </dialog>
    </section>
  );
}
