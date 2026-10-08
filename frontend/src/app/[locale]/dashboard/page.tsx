"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ProfileCard } from "@/components/dashboard/ProfileCard";
import { AnalysisBalanceCard } from "@/components/dashboard/buy/AnalysisBalanceCard";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { StatCard } from "@/components/dashboard/StatCard";
import { AnalysisCard } from "@/components/dashboard/AnalysisCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { StorePromoCard } from "@/components/dashboard/StorePromoCard";
import { InspectionHelpBanner } from "@/components/dashboard/InspectionHelpBanner";
import { ClipboardIcon, BuildingIcon, MapPinIcon, WalletIcon, ShieldIcon, ArrowRightIcon } from "@/components/icons";
import { LOCALES, type AppLocale } from "@/i18n/locales";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { ProfileSummary } from "@/lib/analysis/ownership";
import { uploadBrfAnnualReport } from "@/lib/brf/uploadClient";
import { BRF_REPORT_ACCEPT } from "@/lib/brf/uploadLimits";
import { ROUTES } from "@/components/site/navigation";

interface OwnedAnalysis {
  requestId: string;
  analysisId: string;
  propertyId: string;
  address: string;
  status: "pending" | "complete" | "failed";
  analysisType: "full" | "area";
  requestedAt: string;
  /** The person-reviewed BRF analysis (full analyses only; see /api/profile/analyses). */
  brfReview: { status: "pending" | "published" | "not_applicable"; dueAt: string | null } | null;
}

/** Dates written the way the page's language writes them. */
function useDateFormats() {
  const locale = useLocale() as AppLocale;
  return useMemo(() => {
    const formatLocale = LOCALES[locale].formatLocale;
    return {
      date: new Intl.DateTimeFormat(formatLocale, { day: "numeric", month: "long", year: "numeric" }),
      due: new Intl.DateTimeFormat(formatLocale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
      monthYear: new Intl.DateTimeFormat(formatLocale, { month: "long", year: "numeric" }),
    };
  }, [locale]);
}

function initialsFor(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

export default function DashboardPage() {
  const t = useTranslations("dashboard.overview");
  const router = useRouter();
  const { user } = useAuth();
  const formats = useDateFormats();
  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [analyses, setAnalyses] = useState<OwnedAnalysis[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fullName = (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "";

  const load = useCallback(async () => {
    const [summaryRes, analysesRes] = await Promise.all([
      fetch("/api/profile/summary"),
      fetch("/api/profile/analyses"),
    ]);
    if (summaryRes.ok) setSummary(await summaryRes.json());
    if (analysesRes.ok) setAnalyses((await analysesRes.json()).analyses);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleOpen(analysis: OwnedAnalysis) {
    if (analysis.status === "complete") {
      router.push({ pathname: "/report", query: { id: analysis.analysisId } });
    } else if (analysis.status === "pending") {
      router.push({ pathname: "/analyzing", query: { id: analysis.analysisId } });
    }
  }

  async function handleDelete(requestId: string) {
    if (deletingId) return;
    setDeletingId(requestId);
    try {
      const res = await fetch(`/api/profile/analyses/${requestId}`, { method: "DELETE" });
      if (res.ok) {
        setAnalyses((prev) => prev?.filter((a) => a.requestId !== requestId) ?? null);
        // The per-kind counts are derived from the same rows, so refresh them.
        await load();
      }
    } finally {
      setDeletingId(null);
    }
  }

  /** Returns null on success, or an error message to show the user. */
  async function handleUploadBrfReport(propertyId: string, file: File): Promise<string | null> {
    const result = await uploadBrfAnnualReport(propertyId, file);
    if (!result.ok) return result.message;
    await load();
    return null;
  }

  const hasAnalyses = (analyses?.length ?? 0) > 0;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8 lg:flex-row">
      {/* Left column: profile */}
      <aside className="dash-enter flex w-full shrink-0 flex-col gap-5 lg:w-[300px]" style={stagger(1)}>
        <ProfileCard
          name={fullName || t("unnamedUser")}
          email={user?.email ?? ""}
          memberSince={summary ? formats.monthYear.format(new Date(summary.memberSince)) : "—"}
          initials={initialsFor(fullName)}
        />
        <AnalysisBalanceCard />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <div className="dash-enter" style={stagger(0)}>
              <h1 className="text-2xl font-semibold tracking-tight text-ka-ink">
                {t("greeting", { name: fullName.split(" ")[0] || t("nameFallback") })}
              </h1>
              <p className="mt-1 text-sm text-ka-muted">{t("lead")}</p>
            </div>

            <div className="dash-enter grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" style={stagger(2)}>
              <StatCard label={t("stats.brf")} value={String(summary?.analyses.brf ?? "—")} icon={<BuildingIcon />} />
              <StatCard label={t("stats.area")} value={String(summary?.analyses.area ?? "—")} icon={<MapPinIcon />} />
              <StatCard label={t("stats.hiddenCosts")} value={String(summary?.analyses.hiddenCosts ?? "—")} icon={<WalletIcon />} />
              <StatCard label={t("stats.total")} value={String(summary?.analyses.total ?? "—")} icon={<ClipboardIcon />} />
            </div>

            <div className="dash-enter" style={stagger(3)}>
              <DashboardSection title={t("analyses")}>
                {hasAnalyses ? (
                  <div className="flex flex-col gap-3">
                    {analyses!.map((analysis) => (
                      <OwnedAnalysisItem
                        key={analysis.requestId}
                        analysis={analysis}
                        formats={formats}
                        onOpen={() => handleOpen(analysis)}
                        onDelete={() => handleDelete(analysis.requestId)}
                        onUploadBrfReport={(file) => handleUploadBrfReport(analysis.propertyId, file)}
                        deleting={deletingId === analysis.requestId}
                      />
                    ))}
                  </div>
                ) : analyses !== null ? (
                  <EmptyState
                    title={t("empty.title")}
                    description={t("empty.text")}
                    actionLabel={t("empty.action")}
                    onAction={() => router.push(ROUTES.skapaAnalys)}
                  />
                ) : null}
              </DashboardSection>
            </div>
          </div>

          {/* Right column: quick access */}
          <aside className="dash-enter flex w-full shrink-0 flex-col gap-5 lg:w-[280px]" style={stagger(4)}>
            <QuickActionsCard />
            <StorePromoCard />
          </aside>
        </div>

        <div className="dash-enter" style={stagger(5)}>
          <InspectionHelpBanner />
        </div>
      </div>
    </div>
  );
}

function OwnedAnalysisItem({
  analysis,
  formats,
  onOpen,
  onDelete,
  onUploadBrfReport,
  deleting,
}: {
  analysis: OwnedAnalysis;
  formats: ReturnType<typeof useDateFormats>;
  onOpen: () => void;
  onDelete: () => void;
  onUploadBrfReport: (file: File) => Promise<string | null>;
  deleting: boolean;
}) {
  const t = useTranslations("dashboard.analysis");
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploaded(false);
    try {
      const error = await onUploadBrfReport(file);
      setUploadError(error);
      setUploaded(error === null);
    } finally {
      setUploading(false);
    }
  }

  const review = analysis.brfReview;
  const brfLine =
    analysis.status !== "complete" || !review || review.status === "not_applicable"
      ? null
      : review.status === "published"
        ? { text: t("brf.published"), tone: "text-ka-green-700" }
        : review.dueAt && new Date(review.dueAt).getTime() > Date.now()
          ? { text: t("brf.dueBy", { when: formats.due.format(new Date(review.dueAt)) }), tone: "text-ka-amber-700" }
          : { text: t("brf.pending"), tone: "text-ka-amber-700" };

  const status: "ready" | "processing" | "expired" =
    analysis.status === "complete" ? "ready" : analysis.status === "pending" ? "processing" : "expired";

  const isFull = analysis.analysisType === "full";
  const planLabel =
    analysis.status === "pending"
      ? t("plan.pending")
      : analysis.status === "failed"
        ? t("plan.failed")
        : isFull
          ? t("plan.full")
          : t("plan.area");

  return (
    <AnalysisCard
      address={analysis.address}
      analysisDate={formats.date.format(new Date(analysis.requestedAt))}
      planLabel={planLabel}
      status={status}
      onOpen={onOpen}
      footer={
        <>
          {brfLine && <p className={`mb-2 text-xs font-medium ${brfLine.tone}`}>{brfLine.text}</p>}
          {analysis.status === "complete" && isFull && (
            <button
              type="button"
              onClick={() => router.push({ pathname: "/dashboard/inspection", query: { propertyId: analysis.propertyId } })}
              className="mb-2.5 flex w-fit items-center gap-1.5 rounded-lg border border-ka-green-700/30 bg-ka-sage/60 px-3 py-1.5 text-xs font-semibold text-ka-green-700 transition hover:bg-ka-sage/60"
            >
              <ShieldIcon className="h-3.5 w-3.5" />
              {t("continueInspection")}
              <ArrowRightIcon className="h-3 w-3" />
            </button>
          )}
          <div className="flex items-center gap-4 text-xs">
            {isFull && review?.status !== "not_applicable" && (
              <label className="cursor-pointer font-medium text-ka-green-700 transition hover:text-ka-green-800">
                {uploading ? t("uploading") : t("uploadReport")}
                <input type="file" accept={BRF_REPORT_ACCEPT} className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="font-medium text-ka-muted transition hover:text-ka-red-600 disabled:opacity-50"
            >
              {deleting ? t("deleting") : t("delete")}
            </button>
          </div>
          {uploaded && <p className="text-xs text-ka-green-700">{t("uploadThanks")}</p>}
          {uploadError && <p className="text-xs text-ka-red-600">{uploadError}</p>}
        </>
      }
    />
  );
}
