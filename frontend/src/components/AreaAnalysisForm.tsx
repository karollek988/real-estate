"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Field } from "./Field";
import { Button } from "./Button";
import { AnalysisSubmitError } from "./AnalysisSubmitError";
import { ArrowRightIcon } from "./icons";
import { OMRADESANALYS_PRICE_SEK } from "@/lib/pricing";
import { reportPathFor, submitAnalysis } from "@/lib/analysis/submit";

/**
 * The standalone Områdesanalys: one address in, a report about the area
 * around it out. Takes one Områdesanalys credit (bought for
 * OMRADESANALYS_PRICE_SEK on /buy).
 */
export function AreaAnalysisForm() {
  const t = useTranslations("forms.area");
  const tSubmit = useTranslations("forms.submit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const raw = new FormData(e.currentTarget).get("address");
    const address = typeof raw === "string" ? raw.trim() : "";

    if (address === "") {
      setError({ code: "invalid_request", message: t("errors.address") });
      return;
    }
    // Mirrors the API: a street name alone matches places all over Sweden.
    if (!address.includes(",")) {
      setError({
        code: "address_needs_city",
        message: t("errors.needsCity"),
      });
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await submitAnalysis({ analysisType: "area", address }, { fallback: tSubmit("fallback"), unauthorized: tSubmit("unauthorized") });
    if (!result.ok) {
      setError({ code: result.code, message: result.message });
      setSubmitting(false);
      return;
    }
    router.push(reportPathFor(result));
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <p className="text-sm leading-relaxed text-white/60">
        {t("intro", { price: OMRADESANALYS_PRICE_SEK })}
      </p>
      <Field
        id="area-address"
        name="address"
        label={t("addressLabel")}
        type="text"
        hint={t("addressHint")}
        required
      />

      <AnalysisSubmitError error={error} />

      <Button type="submit" className="w-full sm:w-auto sm:self-start" disabled={submitting}>
        {submitting ? t("submitting") : t("submit")}
        <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </form>
  );
}
