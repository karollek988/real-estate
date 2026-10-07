"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Field, SelectField } from "./Field";
import { Button } from "./Button";
import { AnalysisSubmitError } from "./AnalysisSubmitError";
import { ArrowRightIcon } from "./icons";
import { reportPathFor, submitAnalysis } from "@/lib/analysis/submit";
import type { ManualListingFields } from "@/lib/analysis/listing/manual";

// The choices of the drop-down lists. `value` is what is saved and what the analysis understands (always
// Swedish); `id` names the choice's label in the messages (forms.manual.conditions / .propertyTypes).
const CONDITIONS = [
  { value: "Utmärkt", id: "excellent" },
  { value: "Bra", id: "good" },
  { value: "Okej", id: "okay" },
  { value: "Behöver renovering", id: "needsRenovation" },
] as const;
const ENERGY_CLASSES = ["A+", "A", "B", "C", "D", "E", "F", "G"];
const PROPERTY_TYPES = [
  { value: "Bostadsrätt", id: "bostadsratt" },
  { value: "Äganderätt", id: "aganderatt" },
  { value: "Arrende", id: "arrende" },
  { value: "Bostadsrätt (nyproduktion)", id: "bostadsrattNyproduktion" },
] as const;

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
  const t = useTranslations("forms.manual");
  const tSubmit = useTranslations("forms.submit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
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

    const invalid = (message: string) => setError({ code: "invalid_request", message });
    if (manual.address === "") {
      invalid(t("errors.address"));
      return;
    }
    if (manual.askingPrice === null) {
      invalid(t("errors.askingPrice"));
      return;
    }
    if (manual.livingArea === null) {
      invalid(t("errors.livingArea"));
      return;
    }
    if (feeRequired && manual.monthlyFee === null) {
      invalid(t("errors.monthlyFee"));
      return;
    }

    setSubmitting(true);
    setError(null);

    // The Trygghetspaket: the complete analysis of this property.
    const result = await submitAnalysis({ manual, analysisType: "full" }, { fallback: tSubmit("fallback"), unauthorized: tSubmit("unauthorized") });
    if (!result.ok) {
      setError({ code: result.code, message: result.message });
      setSubmitting(false);
      return;
    }
    router.push(reportPathFor(result));
  }

  const yesNo = [
    { value: "Ja", label: t("yes") },
    { value: "Nej", label: t("no") },
  ];

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
            label={t("fields.address")}
            type="text"
            defaultValue={initialValues?.address ?? undefined}
            required
          />
        </div>
        <SelectField
          id="property-type"
          name="propertyType"
          label={t("fields.propertyType")}
          options={PROPERTY_TYPES.map(({ value, id }) => ({ value, label: t(`propertyTypes.${id}`) }))}
          placeholder={t("fields.propertyTypePlaceholder")}
          value={propertyType}
          onChange={setPropertyType}
        />
        <Field
          id="living-area"
          name="livingArea"
          label={t("fields.livingArea")}
          type="number"
          min={0}
          defaultValue={initialValues?.livingArea ?? undefined}
          required
        />
        <Field
          id="rooms"
          name="rooms"
          label={t("fields.rooms")}
          type="number"
          min={0}
          step={0.5}
          defaultValue={initialValues?.rooms ?? undefined}
        />
        <Field
          id="asking-price"
          name="askingPrice"
          label={t("fields.askingPrice")}
          type="number"
          hint={t("fields.askingPriceHint")}
          min={0}
          defaultValue={initialValues?.askingPrice ?? undefined}
          required
        />
        <Field
          id="monthly-fee"
          name="monthlyFee"
          label={t("fields.monthlyFee")}
          type="number"
          min={0}
          defaultValue={initialValues?.monthlyFee ?? undefined}
          required={feeRequired}
        />
        <Field
          id="operating-costs"
          name="operatingCosts"
          label={t("fields.operatingCosts")}
          type="number"
          min={0}
          defaultValue={initialValues?.operatingCosts ?? undefined}
        />
        <Field
          id="floor"
          name="floor"
          label={t("fields.floor")}
          type="number"
          defaultValue={initialValues?.floor ?? undefined}
        />
        <Field
          id="building-year"
          name="buildingYear"
          label={t("fields.buildingYear")}
          type="number"
          min={1800}
          defaultValue={initialValues?.buildingYear ?? undefined}
        />
        <SelectField
          id="energy-class"
          name="energyClass"
          label={t("fields.energyClass")}
          options={ENERGY_CLASSES}
          placeholder={t("fields.energyClassPlaceholder")}
          defaultValue={initialValues?.energyClass}
        />
        <SelectField
          id="condition"
          name="condition"
          label={t("fields.condition")}
          options={CONDITIONS.map(({ value, id }) => ({ value, label: t(`conditions.${id}`) }))}
          placeholder={t("fields.conditionPlaceholder")}
          defaultValue={initialValues?.condition}
        />
        <SelectField
          id="balcony"
          name="balcony"
          label={t("fields.balcony")}
          options={yesNo}
          placeholder={t("fields.choose")}
          defaultValue={initialValues?.balcony}
        />
        <SelectField
          id="elevator"
          name="elevator"
          label={t("fields.elevator")}
          options={yesNo}
          placeholder={t("fields.choose")}
          defaultValue={initialValues?.elevator}
        />
        <SelectField
          id="parking"
          name="parking"
          label={t("fields.parking")}
          options={yesNo}
          placeholder={t("fields.choose")}
          defaultValue={initialValues?.parking}
        />
        <div className="sm:col-span-2">
          <Field
            id="broker"
            name="broker"
            label={t("fields.broker")}
            type="text"
            defaultValue={initialValues?.broker ?? undefined}
          />
        </div>
        <div className="sm:col-span-2">
          <Field
            id="agency"
            name="agency"
            label={t("fields.agency")}
            type="text"
            defaultValue={initialValues?.agency ?? undefined}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="description" className="text-sm font-medium text-neutral-200">
            {t("fields.description")}
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={initialValues?.description ?? undefined}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10 resize-none"
          />
        </div>
      </div>

      <p className="text-sm text-neutral-400">
        {t("includes")}
      </p>

      <AnalysisSubmitError error={error} />

      <Button type="submit" className="w-full sm:w-auto sm:self-start" disabled={submitting}>
        {submitting ? t("submitting") : t("submit")}
        <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </form>
  );
}
