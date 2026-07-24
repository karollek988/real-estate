"use client";

import { useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, UploadCloudIcon, WarningIcon } from "@/components/icons";
import { ROOMS, type ChecklistState, type CheckpointState, type Severity } from "@/lib/inspection/types";

const SEVERITIES: { value: Severity; label: string; className: string }[] = [
  { value: "ok", label: "OK", className: "border-green-500/40 bg-green-500/10 text-green-400" },
  { value: "minor", label: "Mindre anmärkning", className: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  { value: "major", label: "Allvarlig anmärkning", className: "border-red-500/40 bg-red-500/10 text-red-300" },
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
  const [openRoom, setOpenRoom] = useState<string | null>(ROOMS[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-2.5">
      {ROOMS.map((room) => {
        const roomState = checklist[room.id];
        const { done, total } = roomProgress(room, roomState);
        const open = openRoom === room.id;
        return (
          <div key={room.id} className="rounded-xl border border-white/10 bg-black/20">
            <button
              type="button"
              onClick={() => setOpenRoom(open ? null : room.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                    done === total
                      ? "bg-green-400/10 text-green-400"
                      : done > 0
                        ? "bg-amber-400/10 text-amber-300"
                        : "bg-white/5 text-neutral-400"
                  }`}
                >
                  {done}/{total}
                </span>
                <p className="text-sm font-medium text-white">{room.label}</p>
              </div>
              <ChevronDownIcon className={`h-4 w-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="flex flex-col gap-3 border-t border-white/5 px-4 py-4">
                {room.checkpoints.map((checkpoint) => {
                  const state = roomState?.[checkpoint.id] ?? EMPTY_CHECKPOINT;
                  return (
                    <CheckpointRow
                      key={checkpoint.id}
                      label={checkpoint.label}
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex flex-1 items-center gap-2.5">
          <input
            type="checkbox"
            checked={state.checked}
            onChange={(e) => onChange({ checked: e.target.checked, severity: e.target.checked ? state.severity ?? "ok" : null })}
            className="h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 text-green-500 focus:ring-green-500/40"
          />
          <span className="text-sm text-neutral-200">{label}</span>
        </label>
        {state.severity === "major" && <WarningIcon className="h-4 w-4 shrink-0 text-red-400" />}
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
                  state.severity === s.value ? s.className : "border-white/10 text-neutral-500 hover:border-white/20"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <textarea
            value={state.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Anteckningar..."
            rows={2}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-white/20 disabled:opacity-60"
            >
              <UploadCloudIcon className="h-3.5 w-3.5" />
              {uploading ? "Laddar upp..." : "Lägg till foto"}
            </button>
            {photoCount > 0 && <CheckIcon className="h-3.5 w-3.5 text-green-400" />}
            {photoCount > 0 && <span className="text-xs text-neutral-500">{photoCount} foto{photoCount > 1 ? "n" : ""}</span>}
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
