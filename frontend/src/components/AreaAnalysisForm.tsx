"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const raw = new FormData(e.currentTarget).get("address");
    const address = typeof raw === "string" ? raw.trim() : "";

    if (address === "") {
      setError({ code: "invalid_request", message: "Ange adressen du vill analysera området runt." });
      return;
    }
    // Mirrors the API: a street name alone matches places all over Sweden.
    if (!address.includes(",")) {
      setError({
        code: "address_needs_city",
        message: "Ange både gatuadress och ort, till exempel Storgatan 12, Stockholm.",
      });
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await submitAnalysis({ analysisType: "area", address });
    if (!result.ok) {
      setError({ code: result.code, message: result.message });
      setSubmitting(false);
      return;
    }
    router.push(reportPathFor(result));
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <p className="text-sm leading-relaxed text-neutral-400">
        Skriv in en adress så analyserar vi området runt den: service, skolor, pendling och trygghet. Kostar{" "}
        {OMRADESANALYS_PRICE_SEK} kr och dras från dina Områdesanalyser.
      </p>
      <Field
        id="area-address"
        name="address"
        label="Adress och ort"
        type="text"
        hint="Till exempel Storgatan 12, Stockholm"
        required
      />

      <AnalysisSubmitError error={error} />

      <Button type="submit" className="w-full sm:w-auto sm:self-start" disabled={submitting}>
        {submitting ? "Analyserar..." : "Analysera området"}
        <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </form>
  );
}
