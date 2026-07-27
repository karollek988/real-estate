"use client";

import { useState } from "react";
import { StarFilledIcon, CheckIcon, ArrowRightIcon, LockIcon } from "@/components/icons";

const FEATURES = ["Prisbedömning", "Områdesanalys", "BRF-analys", "Riskbedömning", "Rekommendation"];

interface PremiumHighlightCardProps {
  price: number;
  onRequireAuth: () => void;
}

export function PremiumHighlightCard({ price, onRequireAuth }: PremiumHighlightCardProps) {
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
      if (res.status === 401) {
        onRequireAuth();
        return;
      }
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
    <div className="card-lift relative overflow-hidden rounded-3xl border border-green-500/30 bg-gradient-to-br from-green-500/[0.09] via-[#0F1714] to-[#0B100E] p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)] sm:p-8">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-green-700">
        <StarFilledIcon className="h-3.5 w-3.5" />
        Mest populär
      </span>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-[26px]">
            Premium Decision Analysis
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-neutral-300">
            Den mest kompletta analysen — för dig som vill ha full trygghet.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-400">
            Få ett professionellt beslutsunderlag med allt du behöver för att fatta rätt beslut.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {FEATURES.map((feature) => (
              <span
                key={feature}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-200"
              >
                <CheckIcon className="h-3.5 w-3.5 text-green-400" />
                {feature}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <div className="lg:text-right">
            <p className="text-4xl font-bold tracking-tight text-white">{price} kr</p>
            <p className="mt-1 text-sm text-neutral-400">Engångsköp • Ingen bindningstid</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleBuy}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-6 py-3.5 text-[15px] font-semibold text-[#06120C] transition-all duration-200 hover:bg-green-400 hover:shadow-[0_10px_30px_-8px_rgba(74,222,128,0.55)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
          >
            {loading ? "Skapar betalning..." : "Köp analys nu"}
            {!loading && <ArrowRightIcon className="h-4 w-4" />}
          </button>

          <p className="flex items-center gap-1.5 text-xs text-neutral-500">
            <LockIcon className="h-3.5 w-3.5" />
            Säker betalning med Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
