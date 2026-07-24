"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/icons";
import type { Observation } from "@/lib/inspection/types";

const EXAMPLES = ["Fuktlukt", "Sprickor", "Vattenskada", "Ojämnt golv", "Färgskada", "Elfel"];

export function ObservationsPanel({
  observations,
  onAdd,
  onRemove,
}: {
  observations: Observation[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Skriv en egen observation, t.ex. fuktlukt i badrummet..."
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10"
        />
        <button
          type="button"
          onClick={submit}
          className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
        >
          Lägg till
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-neutral-500 transition hover:border-white/20 hover:text-neutral-300"
          >
            {ex}
          </button>
        ))}
      </div>

      {observations.length > 0 && (
        <ul className="flex flex-col gap-2">
          {observations.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-neutral-200"
            >
              <span>{o.text}</span>
              <button
                type="button"
                onClick={() => onRemove(o.id)}
                aria-label="Ta bort observation"
                className="shrink-0 text-neutral-500 transition hover:text-red-400"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
