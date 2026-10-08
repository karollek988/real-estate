"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import type { Observation } from "@/lib/inspection/types";

/** Short examples that fill the field when clicked. Their words: inspection.observations.examples.<id> */
const EXAMPLES = ["damp", "cracks", "waterDamage", "uneven", "paint", "electrical"] as const;

export function ObservationsPanel({
  observations,
  onAdd,
  onRemove,
}: {
  observations: Observation[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("inspection.observations");
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
          placeholder={t("placeholder")}
          className="flex-1 rounded-xl border border-ka-line-strong bg-white px-4 py-2.5 text-sm text-ka-ink placeholder:text-ka-muted outline-none transition focus:border-ka-green-700 focus:ring-4 focus:ring-ka-green-700/15"
        />
        <button
          type="button"
          onClick={submit}
          className="rounded-xl bg-ka-green-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ka-green-800"
        >
          {t("add")}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(t(`examples.${example}`))}
            className="rounded-full border border-ka-line-strong px-2.5 py-1 text-[11px] text-ka-muted transition hover:border-ka-green-700/40 hover:text-ka-text"
          >
            {t(`examples.${example}`)}
          </button>
        ))}
      </div>

      {observations.length > 0 && (
        <ul className="flex flex-col gap-2">
          {observations.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-ka-line-strong bg-white px-3 py-2 text-sm text-ka-text"
            >
              <span>{o.text}</span>
              <button
                type="button"
                onClick={() => onRemove(o.id)}
                aria-label={t("remove")}
                className="shrink-0 text-ka-muted transition hover:text-ka-red-600"
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
