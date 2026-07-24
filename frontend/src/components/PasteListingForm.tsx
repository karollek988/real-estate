"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { AnalysisTypeChoice, type AnalysisType } from "./AnalysisTypeChoice";
import { ArrowRightIcon, LinkIcon, SearchIcon } from "./icons";

const SUPPORTED_SITES = [
  "Hemnet",
  "Booli",
  "Boneo",
  "Fastighetsbyrån",
  "Bjurfors",
  "HusmanHagberg",
  "Svensk Fastighetsförmedling",
  "Notar",
];

export function PasteListingForm() {
  const [url, setUrl] = useState("");
  const [analysisType, setAnalysisType] = useState<AnalysisType>("premium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || url.trim() === "") return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), analysisType }),
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
    <form className="flex flex-col" onSubmit={handleSubmit}>
      <label htmlFor="listing-url" className="text-sm font-medium text-neutral-200">
        Länk till bostadsannons
      </label>
      <div className="relative mt-2.5">
        <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          id="listing-url"
          type="url"
          placeholder="https://www.hemnet.se/bostad/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <span className="mt-5 text-sm font-medium text-neutral-200">Analystyp</span>
      <div className="mt-2.5">
        <AnalysisTypeChoice value={analysisType} onChange={setAnalysisType} />
      </div>

      <span className="mt-5 text-sm font-medium text-neutral-200">Populära sajter</span>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {SUPPORTED_SITES.map((site) => (
          <span
            key={site}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-200"
          >
            {site}
          </span>
        ))}
      </div>

      <Button type="submit" className="mt-6 self-start" disabled={submitting}>
        <SearchIcon className="h-4 w-4" />
        {submitting ? "Analyserar..." : "Analysera bostad"}
        <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </form>
  );
}
