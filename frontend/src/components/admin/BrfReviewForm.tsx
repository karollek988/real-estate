"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BRF_FIELD_GROUPS,
  EMPTY_BRF_FIGURES,
  parseBrfFigures,
  type BrfFieldSpec,
  type BrfFigures,
} from "@/lib/brf/figures";
import { interpretBrf, type BrfApartmentContext } from "@/lib/brf/interpret";
import { BrfAnalysis } from "@/components/report/BrfAnalysis";

/**
 * The reviewer's form: every figure the BRF analysis is built from, with what
 * the automatic extraction read next to each field, and a live preview of the
 * chapter exactly as the customer will see it.
 */

type FormValues = Record<keyof BrfFigures, string>;

function toFormValues(figures: BrfFigures): FormValues {
  const out = {} as FormValues;
  for (const key of Object.keys(EMPTY_BRF_FIGURES) as Array<keyof BrfFigures>) {
    const v = figures[key];
    out[key] = v === null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v);
  }
  return out;
}

function toRaw(values: FormValues): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) raw[key] = value === "" ? null : value;
  return raw;
}

function displayPrefill(value: unknown, integer?: boolean, max?: number): string {
  if (value === true) return "ja";
  if (value === false) return "nej";
  if (value === "owned") return "äganderätt";
  if (value === "leasehold") return "tomträtt";
  // Years are shown as years ("2024"), not grouped like amounts ("2 024").
  if (typeof value === "number" && integer && max !== undefined && max <= 2200) return String(value);
  if (typeof value === "number") return new Intl.NumberFormat("sv-SE").format(value);
  return String(value);
}

function Field({
  spec,
  value,
  onChange,
  prefill,
  evidence,
}: {
  spec: BrfFieldSpec;
  value: string;
  onChange: (v: string) => void;
  prefill: unknown;
  evidence: string | undefined;
}) {
  const input =
    "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-[#1B1F27] outline-none focus:border-[#3B5F7A] focus:ring-2 focus:ring-[#3B5F7A]/20";
  let control: React.ReactNode;
  if (spec.kind === "boolean") {
    control = (
      <select className={input} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Vet ej / framgår inte</option>
        <option value="true">Ja</option>
        <option value="false">Nej</option>
      </select>
    );
  } else if (spec.kind === "landTenure") {
    control = (
      <select className={input} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Vet ej / framgår inte</option>
        <option value="owned">Äganderätt (föreningen äger marken)</option>
        <option value="leasehold">Tomträtt</option>
      </select>
    );
  } else if (spec.kind === "longtext") {
    control = <textarea className={`${input} min-h-[84px]`} value={value} maxLength={spec.maxLength} onChange={(e) => onChange(e.target.value)} />;
  } else {
    control = (
      <div className="flex items-center gap-2">
        <input
          className={input}
          value={value}
          inputMode={spec.kind === "number" ? "decimal" : "text"}
          maxLength={spec.maxLength}
          onChange={(e) => onChange(e.target.value)}
        />
        {spec.unit && <span className="shrink-0 text-xs text-neutral-500">{spec.unit}</span>}
      </div>
    );
  }

  const hasPrefill = prefill !== undefined && prefill !== null;
  const differs = hasPrefill && value !== "" && parseBrfFigures({ [spec.key]: value }).figures[spec.key] !== prefill;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-[#12271D]">{spec.label}</span>
      {control}
      {spec.hint && <span className="text-[11.5px] text-neutral-500">{spec.hint}</span>}
      {hasPrefill && (
        <span className={`text-[11.5px] ${differs ? "text-amber-700" : "text-neutral-500"}`}>
          Avläst automatiskt: {displayPrefill(prefill, spec.integer, spec.max)}
          {evidence ? ` — ${evidence}` : ""}
          {differs ? " (skiljer sig från ifyllt värde)" : ""}
        </span>
      )}
    </label>
  );
}

export function BrfReviewForm({
  propertyId,
  initial,
  prefill,
  evidence,
  apartment,
  associationName,
  status,
}: {
  propertyId: string;
  initial: BrfFigures;
  prefill: Record<string, unknown>;
  evidence: Record<string, string>;
  apartment: BrfApartmentContext;
  associationName: string | null;
  status: "pending" | "published" | "not_applicable";
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(() => toFormValues(initial));
  const [busy, setBusy] = useState<null | "save" | "publish" | "not_applicable">(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; details?: string[] } | null>(null);

  const parsed = useMemo(() => parseBrfFigures(toRaw(values)), [values]);
  const reading = useMemo(() => interpretBrf(parsed.figures, apartment), [parsed.figures, apartment]);

  function applyPrefill() {
    const merged = { ...values };
    for (const [key, value] of Object.entries(prefill)) {
      if (key in merged && merged[key as keyof BrfFigures] === "" && value !== null && value !== undefined) {
        merged[key as keyof BrfFigures] = typeof value === "number" ? String(value).replace(".", ",") : String(value);
      }
    }
    setValues(merged);
  }

  async function submit(action: "save" | "publish" | "not_applicable") {
    if (action === "publish" && !window.confirm("Publicera BRF-analysen? Den visas direkt i kundens rapport och kunden får ett mejl.")) return;
    if (action === "not_applicable" && !window.confirm("Markera att bostaden inte ingår i någon förening? BRF-kapitlet visar då det.")) return;
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/brf-reviews/${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, figures: toRaw(values) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage({ kind: "error", text: data?.error?.message ?? "Något gick fel.", details: data?.error?.details });
        return;
      }
      setMessage({
        kind: "ok",
        text:
          action === "publish"
            ? "Publicerad. Kunden ser BRF-analysen nu och får ett mejl."
            : action === "save"
              ? "Utkastet är sparat (syns inte för kunden)."
              : "Markerad som ej aktuell.",
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const hasPrefill = Object.keys(prefill).length > 0;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        {hasPrefill && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <span>Den automatiska avläsningen hittade {Object.keys(prefill).length} uppgifter. Kontrollera dem mot årsredovisningen.</span>
            <button type="button" onClick={applyPrefill} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-sky-900 ring-1 ring-sky-200 hover:bg-sky-100">
              Fyll tomma fält med avläsningen
            </button>
          </div>
        )}

        {BRF_FIELD_GROUPS.map((group) => (
          <fieldset key={group.title} className="rounded-lg border border-black/10 bg-white p-4">
            <legend className="px-1 text-sm font-semibold text-[#12271D]">{group.title}</legend>
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {group.fields.map((spec) => (
                <div key={spec.key} className={spec.kind === "longtext" ? "sm:col-span-2" : ""}>
                  <Field
                    spec={spec}
                    value={values[spec.key]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [spec.key]: v }))}
                    prefill={prefill[spec.key]}
                    evidence={evidence[spec.key]}
                  />
                </div>
              ))}
            </div>
          </fieldset>
        ))}

        {parsed.errors.length > 0 && (
          <ul className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {parsed.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        {message && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${message.kind === "ok" ? "border-green-200 bg-green-50 text-green-900" : "border-red-200 bg-red-50 text-red-800"}`}>
            <p>{message.text}</p>
            {message.details && (
              <ul className="mt-1 list-disc pl-5">
                {message.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-black/10 bg-[#F5F4F0]/95 py-3 backdrop-blur">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => submit("publish")}
            className="rounded-md bg-[#12271D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1B3A2C] disabled:opacity-50"
          >
            {busy === "publish" ? "Publicerar…" : status === "published" ? "Publicera uppdatering" : "Publicera till kunden"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => submit("save")}
            className="rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-[#12271D] hover:bg-black/[0.03] disabled:opacity-50"
          >
            {busy === "save" ? "Sparar…" : "Spara utkast"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => submit("not_applicable")}
            className="ml-auto text-xs font-medium text-neutral-500 hover:text-red-700 disabled:opacity-50"
          >
            Ingen förening (ej aktuell)
          </button>
        </div>
      </div>

      <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Förhandsvisning — så ser kunden kapitlet</p>
        <div className="rounded-lg border border-black/10 bg-[#FBF9F4] p-5 sm:p-8">
          <BrfAnalysis
            state={{ kind: "published", reading, publishedAt: new Date().toISOString(), update: null }}
            associationName={associationName}
          />
        </div>
      </div>
    </div>
  );
}
