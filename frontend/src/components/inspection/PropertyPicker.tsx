"use client";

import { ArrowRightIcon, HouseIcon } from "@/components/icons";

interface Candidate {
  propertyId: string;
  address: string;
  decisionScore: number | null;
}

export function PropertyPicker({
  candidates,
  onSelect,
}: {
  candidates: Candidate[];
  onSelect: (propertyId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-400">Välj vilken bostad du vill starta eller fortsätta besiktningshjälpen för.</p>
      {candidates.map((c) => (
        <button
          key={c.propertyId}
          type="button"
          onClick={() => onSelect(c.propertyId)}
          className="card-interactive flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0F1417]/85 p-4 text-left transition hover:border-green-500/30"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-400/10 text-green-400">
              <HouseIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-white">{c.address}</p>
              {c.decisionScore !== null && (
                <p className="text-xs text-neutral-500">Decision Score {c.decisionScore}</p>
              )}
            </div>
          </div>
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-neutral-500" />
        </button>
      ))}
    </div>
  );
}
