"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { SparkleIcon, CheckIcon } from "@/components/icons";

interface PremiumAnalysisCardProps {
  price: number;
}

export function PremiumAnalysisCard({ price }: PremiumAnalysisCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey: "premium_analysis" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "Kunde inte skapa betalning.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Något gick fel. Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-green-500/[0.04] to-transparent p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SparkleIcon className="h-5 w-5 text-green-400" />
            <h3 className="text-base font-semibold tracking-tight text-white">
              Premium Decision Analysis
            </h3>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            Komplett beslutsunderlag för en bostad: pris, område, förening, risker och rekommendation.
          </p>
        </div>
        <p className="shrink-0 text-2xl font-semibold tracking-tight text-white">
          {price} kr
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm text-neutral-300">
        <span className="flex items-center gap-1.5">
          <CheckIcon className="h-3.5 w-3.5 text-green-400" />
          Engångsköp
        </span>
        <span className="flex items-center gap-1.5">
          <CheckIcon className="h-3.5 w-3.5 text-green-400" />
          Ingen bindningstid
        </span>
        <span className="flex items-center gap-1.5">
          <CheckIcon className="h-3.5 w-3.5 text-green-400" />
          Omedelbar tillgång
        </span>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div>
        <Button onClick={handleBuy} disabled={loading} className="w-full justify-center py-2.5 text-sm sm:w-auto">
          {loading ? "Skapar betalning..." : "Köp analys"}
        </Button>
      </div>
    </div>
  );
}
