"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, ChevronDownIcon, UploadCloudIcon, WarningIcon } from "@/components/icons";
import { ROOMS, type ChecklistState, type CheckpointState, type Severity } from "@/lib/inspection/types";

/** How serious a remark is, and how its button looks. The labels: inspection.severities.<value> */
const SEVERITIES: { value: Severity; className: string }[] = [
  { value: "ok", className: "border-ka-green-700/40 bg-ka-sage/40 text-ka-green-700" },
  { value: "minor", className: "border-ka-amber-300 bg-ka-amber-100 text-ka-amber-700" },
  { value: "major", className: "border-ka-coral-300 bg-ka-coral-100 text-ka-red-600" },
];

const EMPTY_CHECKPOINT: CheckpointState = { checked: false, severity: null, notes: "", photoIds: [] };

function roomProgress(room: (typeof ROOMS)[number], roomState: ChecklistState[string] | undefined) {
  const total = room.checkpoints.length;
  const done = room.checkpoints.filter((c) => roomState?.[c.id]?.checked).length;
  return { done, total };
}

export function RoomAccordion({
  checklist,
  onCheckpointChange,
  onPhotoUpload,
  photoCountFor,
}: {
  checklist: ChecklistState;
  onCheckpointChange: (roomId: string, checkpointId: string, patch: Partial<CheckpointState>) => void;
  onPhotoUpload: (roomId: string, checkpointId: string, files: FileList) => Promise<void>;
  photoCountFor: (roomId: string, checkpointId: string) => number;
}) {
  const t = useTranslations("inspection");
  const [openRoom, setOpenRoom] = useState<string | null>(ROOMS[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-2.5">
      {ROOMS.map((room) => {
        const roomState = checklist[room.id];
        const { done, total } = roomProgress(room, roomState);
        const open = openRoom === room.id;
        return (
          <div key={room.id} className="rounded-xl border border-ka-line-strong bg-ka-cream">
            <button
              type="button"
              onClick={() => setOpenRoom(open ? null : room.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                    done === total
                      ? "bg-ka-sage/60 text-ka-green-700"
                      : done > 0
                        ? "bg-ka-amber-100 text-ka-amber-700"
                        : "bg-ka-cream text-ka-muted"
                  }`}
                >
                  {done}/{total}
                </span>
                <p className="text-sm font-medium text-ka-ink">{t(`rooms.${room.id}.label`)}</p>
              </div>
              <ChevronDownIcon className={`h-4 w-4 text-ka-muted transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="flex flex-col gap-3 border-t border-ka-line px-4 py-4">
                {room.checkpoints.map((checkpoint) => {
                  const state = roomState?.[checkpoint.id] ?? EMPTY_CHECKPOINT;
                  return (
                    <CheckpointRow
                      key={checkpoint.id}
                      label={(t as unknown as (key: string) => string)(`rooms.${room.id}.checkpoints.${checkpoint.id}`)}
                      state={state}
                      photoCount={photoCountFor(room.id, checkpoint.id)}
                      onChange={(patch) => onCheckpointChange(room.id, checkpoint.id, patch)}
                      onPhotos={(files) => onPhotoUpload(room.id, checkpoint.id, files)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckpointRow({
  label,
  state,
  photoCount,
  onChange,
  onPhotos,
}: {
  label: string;
  state: CheckpointState;
  photoCount: number;
  onChange: (patch: Partial<CheckpointState>) => void;
  onPhotos: (files: FileList) => Promise<void>;
}) {
  const t = useTranslations("inspection");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="rounded-lg border border-ka-line bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex flex-1 items-center gap-2.5">
          <input
            type="checkbox"
            checked={state.checked}
            onChange={(e) => onChange({ checked: e.target.checked, severity: e.target.checked ? state.severity ?? "ok" : null })}
            className="h-4 w-4 shrink-0 rounded border-ka-line-strong bg-white text-ka-green-700 focus:ring-ka-green-700/40"
          />
          <span className="text-sm text-ka-text">{label}</span>
        </label>
        {state.severity === "major" && <WarningIcon className="h-4 w-4 shrink-0 text-ka-red-600" />}
      </div>

      {state.checked && (
        <div className="mt-3 flex flex-col gap-2.5 pl-6">
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => onChange({ severity: s.value })}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  state.severity === s.value ? s.className : "border-ka-line-strong text-ka-muted hover:border-ka-line-strong"
                }`}
              >
                {t(`severities.${s.value}`)}
              </button>
            ))}
          </div>

          <textarea
            value={state.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder={t("checkpoint.notes")}
            rows={2}
            className="w-full resize-none rounded-lg border border-ka-line-strong bg-white px-3 py-2 text-xs text-ka-ink placeholder:text-ka-muted outline-none transition focus:border-ka-green-700"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-ka-line-strong px-2.5 py-1.5 text-xs font-medium text-ka-text transition hover:border-ka-green-700/40 disabled:opacity-60"
            >
              <UploadCloudIcon className="h-3.5 w-3.5" />
              {uploading ? t("checkpoint.uploading") : t("checkpoint.addPhoto")}
            </button>
            {photoCount > 0 && <CheckIcon className="h-3.5 w-3.5 text-ka-green-700" />}
            {photoCount > 0 && <span className="text-xs text-ka-muted">{t("checkpoint.photos", { count: photoCount })}</span>}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                if (!e.target.files || e.target.files.length === 0) return;
                setUploading(true);
                await onPhotos(e.target.files);
                setUploading(false);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
