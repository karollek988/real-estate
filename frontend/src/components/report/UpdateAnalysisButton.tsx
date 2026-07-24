"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Update analysis" action shown when the displayed analysis is stale.
 * Runs the pipeline again for the property, storing the result as a NEW
 * analysis version — the old one is kept permanently.
 */
export function UpdateAnalysisButton({ propertyId }: { propertyId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/properties/${propertyId}/analyses`, { method: "POST" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error?.message ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      router.push(`/analyzing?id=${data.analysisId}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="rounded-sm border border-[#B98A2E]/40 bg-transparent px-4 py-2 text-xs font-medium text-[#8A6220] transition hover:bg-[#B98A2E]/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Uppdaterar…" : "Uppdatera analysen"}
      </button>
      {error && <p className="text-xs text-[#A2432F]">{error}</p>}
    </div>
  );
}
