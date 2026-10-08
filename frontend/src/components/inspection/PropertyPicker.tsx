"use client";

import { useTranslations } from "next-intl";
import { ArrowRightIcon, HouseIcon } from "@/components/icons";

interface Candidate {
  propertyId: string;
  address: string;
}

export function PropertyPicker({
  candidates,
  onSelect,
}: {
  candidates: Candidate[];
  onSelect: (propertyId: string) => void;
}) {
  const t = useTranslations("inspection");
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ka-muted">{t("picker")}</p>
      {candidates.map((c) => (
        <button
          key={c.propertyId}
          type="button"
          onClick={() => onSelect(c.propertyId)}
          className="card-interactive flex items-center justify-between gap-4 rounded-2xl border border-ka-line-strong bg-white p-4 text-left transition hover:border-ka-green-700/30"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ka-sage/60 text-ka-green-700">
              <HouseIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-ka-ink">{c.address}</p>
            </div>
          </div>
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-ka-muted" />
        </button>
      ))}
    </div>
  );
}
