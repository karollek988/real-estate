"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, SelectField } from "./Field";
import { Button } from "./Button";
import { AnalysisTypeChoice, type AnalysisType } from "./AnalysisTypeChoice";
import { ArrowRightIcon } from "./icons";
import type { ManualListingFields } from "@/lib/analysis/listing/manual";

const CONDITIONS = ["Utmärkt", "Bra", "Okej", "Behöver renovering"];
const ENERGY_CLASSES = ["A+", "A", "B", "C", "D", "E", "F", "G"];
const PROPERTY_TYPES = ["Bostadsrätt", "Äganderätt", "Arrende", "Bostadsrätt (nyproduktion)"];

// Mirrors requiresMonthlyFee() in lib/analysis/pipeline.ts — a monthly fee
// only applies to co-op apartments, not freehold houses.
const APARTMENT_TYPES = new Set(["Bostadsrätt", "Bostadsrätt (nyproduktion)"]);

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export interface ManualEntryFormProps {
  /** Pre-fills the form (e.g. from screenshot OCR) — the user still reviews and submits manually. */
  initialValues?: Partial<ManualListingFields>;
  /** Shown above the form, e.g. flagging that values came from a screenshot and should be checked. */
  sourceNotice?: string;
}

export function ManualEntryForm({ initialValues, sourceNotice }: ManualEntryFormProps = {}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("premium");
  const [propertyType, setPropertyType] = useState(initialValues?.propertyType ?? "");
  const router = useRouter();
  const feeRequired = APARTMENT_TYPES.has(propertyType);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const fd = new FormData(e.currentTarget);
    const manual = {
      address: stringOrNull(fd.get("address")) ?? "",
      livingArea: numberOrNull(fd.get("livingArea")),
      rooms: numberOrNull(fd.get("rooms")),
      monthlyFee: numberOrNull(fd.get("monthlyFee")),
      floor: numberOrNull(fd.get("floor")),
      buildingYear: numberOrNull(fd.get("buildingYear")),
      condition: stringOrNull(fd.get("condition")),
      balcony: stringOrNull(fd.get("balcony")),
      elevator: stringOrNull(fd.get("elevator")),
      parking: stringOrNull(fd.get("parking")),
      askingPrice: numberOrNull(fd.get("askingPrice")),
      operatingCosts: numberOrNull(fd.get("operatingCosts")),
      energyClass: stringOrNull(fd.get("energyClass")),
      description: stringOrNull(fd.get("description")),
      broker: stringOrNull(fd.get("broker")),
      agency: stringOrNull(fd.get("agency")),
      propertyType: stringOrNull(fd.get("propertyType")),
    };

    if (manual.address === "") {
      setError("Ange en adress för att analysera bostaden.");
      return;
    }
    if (manual.askingPrice === null) {
      setError("Ange ett utgångspris för att analysera bostaden.");
      return;
    }
    if (manual.livingArea === null) {
      setError("Ange boarean för att analysera bostaden.");
      return;
    }
    if (feeRequired && manual.monthlyFee === null) {
      setError("Ange månadsavgiften för att analysera bostaden.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual, analysisType }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error?.message ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      // Fresh cached analyses skip the analyzing animation and open directly.
      if (data.cached) {
        router.push(`/report?id=${data.analysisId}`);
      } else {
        router.push(`/analyzing?id=${data.analysisId}`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
      {sourceNotice && (
        <p className="rounded-xl border border-green-500/20 bg-green-500/[0.06] px-4 py-3 text-sm text-green-300">
          {sourceNotice}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            id="address"
            name="address"
            label="Adress"
            type="text"
            placeholder="Storgatan 12, Stockholm"
            defaultValue={initialValues?.address ?? undefined}
            required
          />
        </div>
        <SelectField
          id="property-type"
          name="propertyType"
          label="Typ av bostad"
          options={PROPERTY_TYPES}
          placeholder="Välj typ"
          value={propertyType}
          onChange={setPropertyType}
        />
        <Field
          id="living-area"
          name="livingArea"
          label="Boarea (m²)"
          type="number"
          placeholder="65"
          min={0}
          defaultValue={initialValues?.livingArea ?? undefined}
          required
        />
        <Field
          id="rooms"
          name="rooms"
          label="Antal rum"
          type="number"
          placeholder="3"
          min={0}
          step={0.5}
          defaultValue={initialValues?.rooms ?? undefined}
        />
        <Field
          id="asking-price"
          name="askingPrice"
          label="Utgångspris (kr)"
          type="number"
          placeholder="4 500 000"
          min={0}
          defaultValue={initialValues?.askingPrice ?? undefined}
          required
        />
        <Field
          id="monthly-fee"
          name="monthlyFee"
          label="Månadsavgift (kr)"
          type="number"
          placeholder="3 200"
          min={0}
          defaultValue={initialValues?.monthlyFee ?? undefined}
          required={feeRequired}
        />
        <Field
          id="operating-costs"
          name="operatingCosts"
          label="Driftskostnader (kr/mån)"
          type="number"
          placeholder="1 800"
          min={0}
          defaultValue={initialValues?.operatingCosts ?? undefined}
        />
        <Field
          id="floor"
          name="floor"
          label="Våning"
          type="number"
          placeholder="4"
          defaultValue={initialValues?.floor ?? undefined}
        />
        <Field
          id="building-year"
          name="buildingYear"
          label="Byggår"
          type="number"
          placeholder="1965"
          min={1800}
          defaultValue={initialValues?.buildingYear ?? undefined}
        />
        <SelectField
          id="energy-class"
          name="energyClass"
          label="Energiklass"
          options={ENERGY_CLASSES}
          placeholder="Välj klass"
          defaultValue={initialValues?.energyClass}
        />
        <SelectField
          id="condition"
          name="condition"
          label="Skick"
          options={CONDITIONS}
          placeholder="Välj skick"
          defaultValue={initialValues?.condition}
        />
        <SelectField
          id="balcony"
          name="balcony"
          label="Balkong"
          options={["Ja", "Nej"]}
          placeholder="Välj"
          defaultValue={initialValues?.balcony}
        />
        <SelectField
          id="elevator"
          name="elevator"
          label="Hiss"
          options={["Ja", "Nej"]}
          placeholder="Välj"
          defaultValue={initialValues?.elevator}
        />
        <SelectField
          id="parking"
          name="parking"
          label="Parkering"
          options={["Ja", "Nej"]}
          placeholder="Välj"
          defaultValue={initialValues?.parking}
        />
        <div className="sm:col-span-2">
          <Field
            id="broker"
            name="broker"
            label="Mäklare"
            type="text"
            placeholder="Anna Svensson"
            defaultValue={initialValues?.broker ?? undefined}
          />
        </div>
        <div className="sm:col-span-2">
          <Field
            id="agency"
            name="agency"
            label="Mäklarbyrå"
            type="text"
            placeholder="Fastighetsbyrån"
            defaultValue={initialValues?.agency ?? undefined}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="description" className="text-sm font-medium text-neutral-200">
            Beskrivning
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            placeholder="Klistra in beskrivningen från annonsen..."
            defaultValue={initialValues?.description ?? undefined}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10 resize-none"
          />
        </div>
      </div>

      <div>
        <span className="text-sm font-medium text-neutral-200">Analystyp</span>
        <div className="mt-2.5">
          <AnalysisTypeChoice value={analysisType} onChange={setAnalysisType} />
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Button type="submit" className="w-full sm:w-auto sm:self-start" disabled={submitting}>
        {submitting ? "Analyserar..." : "Analysera bostad"}
        <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </form>
  );
}
