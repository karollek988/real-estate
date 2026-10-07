"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  ShieldIcon,
  DownloadIcon,
  CheckIcon,
  ArrowRightIcon,
  ClipboardIcon,
  WarningIcon,
  LightbulbIcon,
  QuestionIcon,
} from "@/components/icons";
import { InspectionStepTabs } from "@/components/inspection/InspectionStepTabs";
import { ThreeStepGuide } from "@/components/inspection/ThreeStepGuide";
import { PrepChecklist } from "@/components/inspection/PrepChecklist";
import { DocumentDropzone } from "@/components/inspection/DocumentDropzone";
import { GapsList } from "@/components/inspection/GapsList";
import { RoomAccordion } from "@/components/inspection/RoomAccordion";
import { ObservationsPanel } from "@/components/inspection/ObservationsPanel";
import { SummaryView } from "@/components/inspection/SummaryView";
import { PropertyPicker } from "@/components/inspection/PropertyPicker";
import { EmptyState } from "@/components/dashboard/EmptyState";
import type {
  ChecklistState,
  CheckpointState,
  DocumentType,
  InspectionDocument,
  InspectionRecord,
  Observation,
  PrepChecklistState,
} from "@/lib/inspection/types";
import { PREP_STEPS } from "@/lib/inspection/types";
import { buildDataGaps, type DataGap } from "@/lib/inspection/gaps";
import type { AnalysisReport } from "@/lib/analysis/types";
import { ROUTES } from "@/components/site/navigation";

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

interface InspectionApiData {
  inspection: InspectionRecord;
  documents: InspectionDocument[];
  gaps: DataGap[];
  brokerQuestions: string[];
  brfQuestions: string[];
  property: { id: string; address: string; attributes: Record<string, unknown> };
  report: {
    property: AnalysisReport["property"];
  };
  /** The person-reviewed BRF analysis: the points it flags, or when it will be ready. */
  brf: { status: "published" | "awaiting" | "none"; concerns: string[]; dueLabel: string | null };
}

interface OwnedAnalysis {
  propertyId: string;
  address: string;
  status: "pending" | "complete" | "failed";
  analysisType: "full" | "area";
}

function useDebouncedSave(propertyId: string | null) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (patch: Record<string, unknown>) => {
      if (!propertyId) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fetch(`/api/inspections/${propertyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).catch(() => {});
      }, 700);
    },
    [propertyId]
  );
}

function InspectionPageContent() {
  const t = useTranslations("inspection");
  const tDocuments = useTranslations("inspection.documents");
  const tPrep = useTranslations("inspection.prep");
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams?.get("propertyId") ?? null;

  const [candidates, setCandidates] = useState<OwnedAnalysis[] | null>(null);
  const [data, setData] = useState<InspectionApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [noAnalysis, setNoAnalysis] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debouncedSave = useDebouncedSave(propertyId);

  // No property chosen yet — offer the user's completed full analyses to pick
  // from (an Områdesanalys doesn't lead into the guide).
  useEffect(() => {
    if (propertyId) return;
    fetch("/api/profile/analyses")
      .then((r) => r.json())
      .then((body) => {
        const owned = (body.analyses ?? []) as OwnedAnalysis[];
        const complete = owned.filter((a) => a.status === "complete" && a.analysisType === "full");
        const seen = new Set<string>();
        const deduped = complete.filter((a) => {
          if (seen.has(a.propertyId)) return false;
          seen.add(a.propertyId);
          return true;
        });
        setCandidates(deduped);
      })
      .finally(() => setLoading(false));
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    setNoAnalysis(false);
    fetch(`/api/inspections/${propertyId}`)
      .then(async (res) => {
        if (res.status === 403) {
          setNoAnalysis(true);
          return;
        }
        if (!res.ok) return;
        setData(await res.json());
      })
      .finally(() => setLoading(false));
  }, [propertyId]);

  const markSaved = useCallback(() => setSavedAt(Date.now()), []);

  function selectProperty(id: string) {
    router.push({ pathname: "/dashboard/inspection", query: { propertyId: id } });
  }

  function patchLocal(patch: Partial<InspectionRecord>) {
    setData((prev) => (prev ? { ...prev, inspection: { ...prev.inspection, ...patch } } : prev));
  }

  function goToStep(step: 1 | 2 | 3) {
    if (!data) return;
    patchLocal({ step });
    debouncedSave({ step });
  }

  function advanceStep(next: 1 | 2 | 3, extra?: Record<string, unknown>) {
    if (!data) return;
    const status = next === 2 ? "during" : next === 3 ? "after" : "before";
    patchLocal({ step: next, status });
    fetch(`/api/inspections/${data.property.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: next, status, ...extra }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body.inspection) setData((prev) => (prev ? { ...prev, inspection: body.inspection } : prev));
        markSaved();
      })
      .catch(() => {});
  }

  async function uploadDocument(file: File, docType: DocumentType): Promise<string | null> {
    if (!data) return t("dropzone.noProperty");
    const form = new FormData();
    form.append("file", file);
    form.append("docType", docType);
    const res = await fetch(`/api/inspections/${data.property.id}/documents`, { method: "POST", body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok) return body?.error?.message ?? t("dropzone.genericError");
    setData((prev) => {
      if (!prev) return prev;
      const documents = [body.document as InspectionDocument, ...prev.documents];
      const gaps = buildDataGaps(
        { property: prev.report.property } as AnalysisReport,
        prev.property.attributes,
        documents
      );
      return { ...prev, documents, gaps };
    });
    markSaved();
    return null;
  }

  function togglePrepStep(stepId: string, checked: boolean) {
    if (!data) return;
    const prepChecklist: PrepChecklistState = { ...data.inspection.prepChecklist, [stepId]: checked };
    patchLocal({ prepChecklist });
    debouncedSave({ prepChecklist });
    markSaved();
  }

  function updateCheckpoint(roomId: string, checkpointId: string, patch: Partial<CheckpointState>) {
    if (!data) return;
    const current = data.inspection.checklist[roomId]?.[checkpointId] ?? {
      checked: false,
      severity: null,
      notes: "",
      photoIds: [],
    };
    const checklist: ChecklistState = {
      ...data.inspection.checklist,
      [roomId]: { ...data.inspection.checklist[roomId], [checkpointId]: { ...current, ...patch } },
    };
    patchLocal({ checklist });
    debouncedSave({ checklist });
    markSaved();
  }

  async function uploadPhoto(roomId: string, checkpointId: string, files: FileList) {
    if (!data) return;
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("room", roomId);
      form.append("checkpointId", checkpointId);
      const res = await fetch(`/api/inspections/${data.property.id}/photos`, { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.photo) {
        const current = data.inspection.checklist[roomId]?.[checkpointId] ?? {
          checked: true,
          severity: "ok" as const,
          notes: "",
          photoIds: [],
        };
        updateCheckpoint(roomId, checkpointId, { photoIds: [...current.photoIds, body.photo.id] });
      }
    }
    markSaved();
  }

  function photoCountFor(roomId: string, checkpointId: string): number {
    return data?.inspection.checklist[roomId]?.[checkpointId]?.photoIds.length ?? 0;
  }

  function addObservation(text: string) {
    if (!data) return;
    const observation: Observation = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() };
    const observations = [...data.inspection.observations, observation];
    patchLocal({ observations });
    debouncedSave({ observations });
    markSaved();
  }

  function removeObservation(id: string) {
    if (!data) return;
    const observations = data.inspection.observations.filter((o) => o.id !== id);
    patchLocal({ observations });
    debouncedSave({ observations });
    markSaved();
  }

  function downloadChecklist() {
    // the checklist as a text file, written in the page's language
    const text = tPrep as unknown as (key: string) => string;
    const lines = [
      t("download.heading"),
      "",
      ...PREP_STEPS.map(
        (s) =>
          `${s.order}. ${text(`${s.id}.title`)}\n   ${text(`${s.id}.description`)}` +
          (s.items.length > 0
            ? `\n   ${t("download.needs")}\n${s.items.map((i) => `   - ${text(`${s.id}.items.${i.id}.name`)}: ${text(`${s.id}.items.${i.id}.whereToFind`)}`).join("\n")}`
            : "")
      ),
    ];
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = t("download.fileName");
    a.click();
    URL.revokeObjectURL(url);
  }


  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <p className="text-sm text-neutral-400">{t("loading")}</p>
      </div>
    );
  }

  if (!propertyId) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="dash-enter" style={stagger(0)}>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-white">
            <ShieldIcon className="h-6 w-6 text-green-400" />
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">{t("lead")}</p>
        </div>
        <div className="dash-enter" style={stagger(1)}>
          {candidates && candidates.length > 0 ? (
            <PropertyPicker candidates={candidates} onSelect={selectProperty} />
          ) : (
            <EmptyState
              title={t("empty.noAnalysis.title")}
              description={t("empty.noAnalysis.text")}
              actionLabel={t("empty.noAnalysis.action")}
              onAction={() => router.push(ROUTES.skapaAnalys)}
            />
          )}
        </div>
      </div>
    );
  }

  if (noAnalysis) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <EmptyState
          title={t("empty.requiresPackage.title")}
          description={t("empty.requiresPackage.text")}
          actionLabel={t("empty.requiresPackage.action")}
          onAction={() => router.push(ROUTES.skapaAnalys)}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <EmptyState
          title={t("empty.loadFailed.title")}
          description={t("empty.loadFailed.text")}
          actionLabel={t("empty.loadFailed.action")}
          onAction={() => router.push("/dashboard")}
        />
      </div>
    );
  }

  const { inspection } = data;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <div className="dash-enter flex items-center justify-between gap-4" style={stagger(0)}>
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-white">
            <ShieldIcon className="h-6 w-6 text-green-400" />
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-neutral-400">{t("header", { address: data.property.address })}</p>
        </div>
        {savedAt && <span className="shrink-0 text-xs text-neutral-500">{t("saved")}</span>}
      </div>

      <div className="dash-enter" style={stagger(1)}>
        <InspectionStepTabs current={inspection.step} furthestUnlocked={3} onSelect={goToStep} />
      </div>

      {inspection.step === 1 && (
        <div className="dash-enter grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]" style={stagger(2)}>
          <div className="flex flex-col gap-6">
            <Card title={t("step1.prepTitle")} subtitle={t("step1.prepLead")}>
              <PrepChecklist state={inspection.prepChecklist} onToggle={togglePrepStep} />
            </Card>

            <Card title={t("step1.knownTitle")} subtitle={t("step1.knownLead")}>
              <GapsList gaps={data.gaps} onUpload={uploadDocument} />
            </Card>

            <Card title={t("step1.docsTitle")} subtitle={t("step1.docsLead")}>
              <DocumentDropzone onUpload={uploadDocument} />
              {data.documents.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2">
                  {data.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-2.5 text-sm text-neutral-300">
                      <CheckIcon className="h-4 w-4 shrink-0 text-green-400" />
                      {d.originalFilename ?? tDocuments(d.docType)}
                      <span className="text-xs text-neutral-500">({tDocuments(d.docType)})</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={t("step1.downloadTitle")} subtitle={t("step1.downloadLead")}>
              <button
                type="button"
                onClick={downloadChecklist}
                className="flex w-fit items-center gap-2 rounded-xl border border-green-500/30 px-4 py-2.5 text-sm font-semibold text-green-300 transition hover:bg-green-500/10"
              >
                {t("step1.download")}
                <DownloadIcon className="h-4 w-4" />
              </button>
            </Card>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-green-500/20 bg-green-500/[0.05] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{t("step1.ready.title")}</p>
                  <p className="text-xs text-neutral-400">{t("step1.ready.text")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => advanceStep(2)}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
              >
                {t("step1.ready.action")}
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <Card title={t("step1.brf.title")} icon={<WarningIcon className="h-4 w-4 text-amber-400" />}>
              {data.brf.status === "published" ? (
                data.brf.concerns.length > 0 ? (
                  <ul className="flex flex-col gap-2.5">
                    {data.brf.concerns.map((c) => (
                      <li key={c} className="text-sm text-neutral-300">
                        {c}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-neutral-400">{t("step1.brf.noConcerns")}</p>
                )
              ) : data.brf.status === "awaiting" ? (
                <p className="text-sm text-neutral-400">
                  {data.brf.dueLabel ? t("step1.brf.awaitingDue", { due: data.brf.dueLabel }) : t("step1.brf.awaiting")}
                </p>
              ) : (
                <p className="text-sm text-neutral-400">{t("step1.brf.notBrf")}</p>
              )}
            </Card>

            <Card title={t("step1.brokerQuestions")} icon={<QuestionIcon className="h-4 w-4 text-neutral-300" />}>
              <ul className="flex flex-col gap-2">
                {data.brokerQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-neutral-300">
                    {q}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title={t("step1.brfQuestions")} icon={<QuestionIcon className="h-4 w-4 text-neutral-300" />}>
              <ul className="flex flex-col gap-2">
                {data.brfQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-neutral-300">
                    {q}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title={t("step1.tips.title")} icon={<LightbulbIcon className="h-4 w-4 text-amber-300" />}>
              <p className="text-sm leading-relaxed text-neutral-400">{t("step1.tips.text")}</p>
            </Card>
          </div>
        </div>
      )}

      {inspection.step === 2 && (
        <div className="dash-enter grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]" style={stagger(2)}>
          <div className="flex flex-col gap-6">
            <Card title={t("step2.title")} subtitle={t("step2.lead")}>
              <ThreeStepGuide
                steps={[
                  { title: t("step2.guide.rooms.title"), description: t("step2.guide.rooms.text") },
                  { title: t("step2.guide.notes.title"), description: t("step2.guide.notes.text") },
                  { title: t("step2.guide.photos.title"), description: t("step2.guide.photos.text") },
                ]}
              />
            </Card>

            <Card title={t("step2.roomsTitle")}>
              <RoomAccordion
                checklist={inspection.checklist}
                onCheckpointChange={updateCheckpoint}
                onPhotoUpload={uploadPhoto}
                photoCountFor={photoCountFor}
              />
            </Card>
          </div>
          <div className="flex flex-col gap-6">
            <Card title={t("step2.observationsTitle")} icon={<ClipboardIcon className="h-4 w-4 text-neutral-300" />}>
              <ObservationsPanel
                observations={inspection.observations}
                onAdd={addObservation}
                onRemove={removeObservation}
              />
            </Card>
            <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.05] p-5">
              <p className="text-sm font-semibold text-white">{t("step2.done.title")}</p>
              <p className="mt-1 text-xs text-neutral-400">{t("step2.done.text")}</p>
              <button
                type="button"
                onClick={() => advanceStep(3, { requestSummary: true })}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
              >
                {t("step2.done.action")}
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {inspection.step === 3 && (
        <div className="dash-enter" style={stagger(2)}>
          {inspection.summary ? (
            <SummaryView summary={inspection.summary} />
          ) : (
            <EmptyState
              title={t("empty.noSummary.title")}
              description={t("empty.noSummary.text")}
              actionLabel={t("empty.noSummary.action")}
              onAction={() => goToStep(2)}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function InspectionPage() {
  return (
    <Suspense fallback={null}>
      <InspectionPageContent />
    </Suspense>
  );
}

function Card({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
        {icon}
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
