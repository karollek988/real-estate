"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { DOCUMENT_TYPE_LABELS, PREP_STEPS } from "@/lib/inspection/types";
import { buildDataGaps, buildBrfQuestions, buildBrokerQuestions, type DataGap } from "@/lib/inspection/gaps";
import type { AnalysisReport, DecisionFactorResult } from "@/lib/analysis/types";

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

interface InspectionApiData {
  inspection: InspectionRecord;
  documents: InspectionDocument[];
  gaps: DataGap[];
  brokerQuestions: string[];
  brfQuestions: string[];
  property: { id: string; address: string; attributes: Record<string, unknown> };
  report: {
    decisionScore: number;
    verdict: string;
    summary: string;
    property: AnalysisReport["property"];
    decisionFactors: DecisionFactorResult[];
  };
}

interface OwnedAnalysis {
  propertyId: string;
  address: string;
  status: "pending" | "complete" | "failed";
  decisionScore: number | null;
  analysisType: "free" | "premium";
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

export default function InspectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId");

  const [candidates, setCandidates] = useState<OwnedAnalysis[] | null>(null);
  const [data, setData] = useState<InspectionApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notPremium, setNotPremium] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const debouncedSave = useDebouncedSave(propertyId);

  // No property chosen yet — offer the user's Premium properties to pick from.
  useEffect(() => {
    if (propertyId) return;
    fetch("/api/profile/analyses")
      .then((r) => r.json())
      .then((body) => {
        const owned = (body.analyses ?? []) as OwnedAnalysis[];
        const premiumComplete = owned.filter((a) => a.analysisType === "premium" && a.status === "complete");
        const seen = new Set<string>();
        const deduped = premiumComplete.filter((a) => {
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
    setNotPremium(false);
    fetch(`/api/inspections/${propertyId}`)
      .then(async (res) => {
        if (res.status === 403) {
          setNotPremium(true);
          return;
        }
        if (!res.ok) return;
        setData(await res.json());
      })
      .finally(() => setLoading(false));
  }, [propertyId]);

  const markSaved = useCallback(() => setSavedAt(Date.now()), []);

  function selectProperty(id: string) {
    router.push(`/dashboard/inspection?propertyId=${id}`);
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
    if (!data) return "Ingen bostad vald.";
    const form = new FormData();
    form.append("file", file);
    form.append("docType", docType);
    const res = await fetch(`/api/inspections/${data.property.id}/documents`, { method: "POST", body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok) return body?.error?.message ?? "Något gick fel vid uppladdningen.";
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
    const lines = [
      "Köpanalys — Checklista inför besiktning",
      "",
      ...PREP_STEPS.map((s) => `${s.order}. ${s.title}\n   ${s.description}`),
    ];
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "checklista-besiktning.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const knownRisks = useMemo(() => {
    if (!data) return [];
    return data.report.decisionFactors
      .filter((f) => f.score !== null && f.score < 60)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 4);
  }, [data]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <p className="text-sm text-neutral-400">Laddar...</p>
      </div>
    );
  }

  if (!propertyId) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="dash-enter" style={stagger(0)}>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-white">
            <ShieldIcon className="h-6 w-6 text-amber-400" />
            Besiktningshjälp
          </h1>
          <p className="mt-1 text-sm text-neutral-400">Din kompletta guide före, under och efter besiktning.</p>
        </div>
        <div className="dash-enter" style={stagger(1)}>
          {candidates && candidates.length > 0 ? (
            <PropertyPicker candidates={candidates} onSelect={selectProperty} />
          ) : (
            <EmptyState
              title="Ingen Premium-analys hittades"
              description="Besiktningshjälp kräver en färdig Premium-analys för en bostad. Köp eller slutför en Premium-analys för att komma igång."
              actionLabel="Se Premium-paket"
              onAction={() => router.push("/dashboard/buy")}
            />
          )}
        </div>
      </div>
    );
  }

  if (notPremium) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <EmptyState
          title="Kräver en Premium-analys"
          description="Besiktningshjälp är en Premium-funktion. Den här bostaden har ingen Premium-analys kopplad till ditt konto än."
          actionLabel="Se Premium-paket"
          onAction={() => router.push("/dashboard/buy")}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <EmptyState
          title="Kunde inte ladda besiktningen"
          description="Något gick fel. Försök igen om en stund."
          actionLabel="Till översikten"
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
            <ShieldIcon className="h-6 w-6 text-amber-400" />
            Besiktningshjälp
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {data.property.address} · Din kompletta guide före, under och efter besiktning.
          </p>
        </div>
        {savedAt && <span className="shrink-0 text-xs text-neutral-500">Sparat</span>}
      </div>

      <div className="dash-enter" style={stagger(1)}>
        <InspectionStepTabs current={inspection.step} furthestUnlocked={3} onSelect={goToStep} />
      </div>

      {inspection.step === 1 && (
        <div className="dash-enter grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]" style={stagger(2)}>
          <div className="flex flex-col gap-6">
            <Card title="Före besiktning – att tänka på" subtitle="Förbered dig ordentligt genom att samla in rätt information och dokument för att få en så träffsäker analys som möjligt.">
              <PrepChecklist state={inspection.prepChecklist} onToggle={togglePrepStep} />
            </Card>

            <Card title="Vad analysen redan vet" subtitle="Baserat på din slutförda analys av bostaden.">
              <GapsList gaps={data.gaps} onUpload={uploadDocument} />
            </Card>

            <Card title="Dokument att ladda upp" subtitle="Ladda upp relevanta dokument så stärker du analysen och får mer precisa rekommendationer.">
              <DocumentDropzone onUpload={uploadDocument} />
              {data.documents.length > 0 && (
                <ul className="mt-4 flex flex-col gap-2">
                  {data.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-2.5 text-sm text-neutral-300">
                      <CheckIcon className="h-4 w-4 shrink-0 text-green-400" />
                      {d.originalFilename ?? DOCUMENT_TYPE_LABELS[d.docType]}
                      <span className="text-xs text-neutral-500">({DOCUMENT_TYPE_LABELS[d.docType]})</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Ladda ner checklista" subtitle="Ladda ner vår kompletta checklista så har du den med dig vid varje steg.">
              <button
                type="button"
                onClick={downloadChecklist}
                className="flex w-fit items-center gap-2 rounded-xl border border-green-500/30 px-4 py-2.5 text-sm font-semibold text-green-300 transition hover:bg-green-500/10"
              >
                Ladda ner checklista
                <DownloadIcon className="h-4 w-4" />
              </button>
            </Card>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-green-500/20 bg-green-500/[0.05] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-400">
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Redo att gå vidare?</p>
                  <p className="text-xs text-neutral-400">
                    När du har samlat in dokument och gått igenom checklistan är du redo för nästa steg.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => advanceStep(2)}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
              >
                Gå vidare till steg 2
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <Card title="Kända risker" icon={<WarningIcon className="h-4 w-4 text-amber-400" />}>
              {knownRisks.length > 0 ? (
                <ul className="flex flex-col gap-2.5">
                  {knownRisks.map((f) => (
                    <li key={f.id} className="text-sm text-neutral-300">
                      <span className="font-medium text-white">{f.label}:</span> {f.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-400">Inga särskilda risker identifierade i analysen.</p>
              )}
            </Card>

            <Card title="Frågor till mäklaren" icon={<QuestionIcon className="h-4 w-4 text-neutral-300" />}>
              <ul className="flex flex-col gap-2">
                {data.brokerQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-neutral-300">
                    {q}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Frågor till föreningen" icon={<QuestionIcon className="h-4 w-4 text-neutral-300" />}>
              <ul className="flex flex-col gap-2">
                {data.brfQuestions.map((q, i) => (
                  <li key={i} className="text-sm text-neutral-300">
                    {q}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Tips" icon={<LightbulbIcon className="h-4 w-4 text-amber-300" />}>
              <p className="text-sm leading-relaxed text-neutral-400">
                Ju mer information du laddar upp, desto bättre blir vår analys. Saknas något dokument? Kontakta
                styrelsen eller mäklaren.
              </p>
            </Card>
          </div>
        </div>
      )}

      {inspection.step === 2 && (
        <div className="dash-enter grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]" style={stagger(2)}>
          <div className="flex flex-col gap-6">
            <Card title="Under besiktning" subtitle="Gå igenom bostaden rum för rum. Bocka av, sätt allvarlighetsgrad och lägg till foton.">
              <RoomAccordion
                checklist={inspection.checklist}
                onCheckpointChange={updateCheckpoint}
                onPhotoUpload={uploadPhoto}
                photoCountFor={photoCountFor}
              />
            </Card>
          </div>
          <div className="flex flex-col gap-6">
            <Card title="Egna observationer" icon={<ClipboardIcon className="h-4 w-4 text-neutral-300" />}>
              <ObservationsPanel
                observations={inspection.observations}
                onAdd={addObservation}
                onRemove={removeObservation}
              />
            </Card>
            <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.05] p-5">
              <p className="text-sm font-semibold text-white">Klar med genomgången?</p>
              <p className="mt-1 text-xs text-neutral-400">Vi sammanställer en professionell sammanfattning åt dig.</p>
              <button
                type="button"
                onClick={() => advanceStep(3, { requestSummary: true })}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
              >
                Skapa sammanfattning
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
              title="Ingen sammanfattning än"
              description="Gå tillbaka till steg 2 och slutför genomgången för att generera en sammanfattning."
              actionLabel="Till steg 2"
              onAction={() => goToStep(2)}
            />
          )}
        </div>
      )}
    </div>
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
