"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileCard } from "@/components/dashboard/ProfileCard";
import { PremiumPerksCard } from "@/components/dashboard/PremiumPerksCard";
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { StatCard } from "@/components/dashboard/StatCard";
import { DecisionAnalysisCard } from "@/components/dashboard/DecisionAnalysisCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";
import { StorePromoCard } from "@/components/dashboard/StorePromoCard";
import { InspectionHelpBanner } from "@/components/dashboard/InspectionHelpBanner";
import { ClipboardIcon, CrownIcon, TicketIcon, CalendarIcon, ShieldIcon, ArrowRightIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";

interface ProfileSummary {
  premiumRemaining: number;
  freeRemaining: number;
  totalAnalyses: number;
  memberSince: string;
}

interface OwnedAnalysis {
  requestId: string;
  analysisId: string;
  propertyId: string;
  address: string;
  status: "pending" | "complete" | "failed";
  decisionScore: number | null;
  analysisType: "free" | "premium";
  requestedAt: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric" });
const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric" });

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
  const router = useRouter();
  const { user } = useAuth();
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
      router.push(`/report?id=${analysis.analysisId}`);
    } else if (analysis.status === "pending") {
      router.push(`/analyzing?id=${analysis.analysisId}`);
    }
  }

  async function handleDelete(requestId: string) {
    if (deletingId) return;
    setDeletingId(requestId);
    try {
      const res = await fetch(`/api/profile/analyses/${requestId}`, { method: "DELETE" });
      if (res.ok) {
        setAnalyses((prev) => prev?.filter((a) => a.requestId !== requestId) ?? null);
        // "Total analyses created" counts analysis_requests rows directly,
        // so deleting one must be reflected there too.
        setSummary((prev) => (prev ? { ...prev, totalAnalyses: prev.totalAnalyses - 1 } : prev));
      }
    } finally {
      setDeletingId(null);
    }
  }

  /** Returns null on success, or an error message to show the user. */
  async function handleUploadBrfReport(propertyId: string, file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/properties/${propertyId}/brf-report`, { method: "POST", body: form });
    if (res.ok) {
      await load();
      return null;
    }
    const data = await res.json().catch(() => null);
    return data?.error?.message ?? "Något gick fel vid uppladdningen. Försök igen.";
  }

  const hasAnalyses = (analyses?.length ?? 0) > 0;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-8 lg:flex-row">
      {/* Left column: profile */}
      <aside className="dash-enter flex w-full shrink-0 flex-col gap-5 lg:w-[300px]" style={stagger(1)}>
        <ProfileCard
          name={fullName || "Köpanalys-användare"}
          email={user?.email ?? ""}
          memberSince={summary ? MONTH_YEAR_FORMAT.format(new Date(summary.memberSince)) : "—"}
          initials={initialsFor(fullName)}
        />
        <PremiumPerksCard />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <div className="dash-enter" style={stagger(0)}>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Hej {fullName.split(" ")[0] || "there"}! 👋
              </h1>
              <p className="mt-1 text-sm text-neutral-400">
                Här är en översikt av din aktivitet och dina insikter.
              </p>
            </div>

            <div className="dash-enter grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" style={stagger(2)}>
              <StatCard label="Premium-analyser kvar" value={String(summary?.premiumRemaining ?? "—")} icon={<CrownIcon />} />
              <StatCard label="Gratisanalyser kvar" value={String(summary?.freeRemaining ?? "—")} icon={<TicketIcon />} />
              <StatCard label="Analyser skapade totalt" value={String(summary?.totalAnalyses ?? "—")} icon={<ClipboardIcon />} />
              <StatCard
                label="Medlem sedan"
                value={summary ? MONTH_YEAR_FORMAT.format(new Date(summary.memberSince)) : "—"}
                icon={<CalendarIcon />}
              />
            </div>

            <div className="dash-enter" style={stagger(3)}>
              <DashboardSection title="Dina beslutsanalyser">
                {hasAnalyses ? (
                  <div className="flex flex-col gap-3">
                    {analyses!.map((analysis) => (
                      <AnalysisCard
                        key={analysis.requestId}
                        analysis={analysis}
                        onOpen={() => handleOpen(analysis)}
                        onDelete={() => handleDelete(analysis.requestId)}
                        onUploadBrfReport={(file) => handleUploadBrfReport(analysis.propertyId, file)}
                        deleting={deletingId === analysis.requestId}
                      />
                    ))}
                  </div>
                ) : analyses !== null ? (
                  <EmptyState
                    title="Skapa din första beslutsanalys"
                    description="Du har inte skapat några Decision Analyses än. Börja med att analysera en bostad för att se en marknadsvärdering och full genomgång."
                    actionLabel="Skapa din första beslutsanalys"
                    onAction={() => router.push("/")}
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

function AnalysisCard({
  analysis,
  onOpen,
  onDelete,
  onUploadBrfReport,
  deleting,
}: {
  analysis: OwnedAnalysis;
  onOpen: () => void;
  onDelete: () => void;
  onUploadBrfReport: (file: File) => Promise<string | null>;
  deleting: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const error = await onUploadBrfReport(file);
      setUploadError(error);
    } finally {
      setUploading(false);
    }
  }

  const status: "ready" | "processing" | "expired" =
    analysis.status === "complete" ? "ready" : analysis.status === "pending" ? "processing" : "expired";

  return (
    <DecisionAnalysisCard
      address={analysis.address}
      analysisDate={DATE_FORMAT.format(new Date(analysis.requestedAt))}
      fairPrice={analysis.decisionScore !== null ? `Score ${analysis.decisionScore}` : "Väntar"}
      status={status}
      onOpen={onOpen}
      footer={
        <>
          {analysis.status === "complete" && analysis.analysisType === "premium" && (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/inspection?propertyId=${analysis.propertyId}`)}
              className="mb-2.5 flex w-fit items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/20"
            >
              <ShieldIcon className="h-3.5 w-3.5" />
              Fortsätt till Besiktningshjälp
              <ArrowRightIcon className="h-3 w-3" />
            </button>
          )}
          <div className="flex items-center gap-4 text-xs">
            <label className="cursor-pointer font-medium text-green-400 transition hover:text-green-300">
              {uploading ? "Laddar upp..." : "Ladda upp senaste årsredovisning"}
              <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} disabled={uploading} />
            </label>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="font-medium text-neutral-400 transition hover:text-red-400 disabled:opacity-50"
            >
              {deleting ? "Tar bort..." : "Ta bort"}
            </button>
          </div>
          {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
        </>
      }
    />
  );
}
