"use client";

import { useState } from "react";
import { CheckIcon, ArrowRightIcon, LockIcon } from "@/components/icons";

interface BuyPlanCardProps {
  eyebrow: string;
  title: string;
  description: string;
  price: number;
  period?: string;
  features: string[];
  ctaLabel: string;
  caption?: string;
  highlighted?: boolean;
  badge?: string;
  priceKey?: string | null;
  onRequireAuth: () => void;
  onFreeCta?: () => void;
}

export function BuyPlanCard({
  eyebrow,
  title,
  description,
  price,
  period,
  features,
  ctaLabel,
  caption,
  highlighted = false,
  badge,
  priceKey,
  onRequireAuth,
  onFreeCta,
}: BuyPlanCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    if (!priceKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey }),
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
    <div
      className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur-xl ${
        highlighted
          ? "card-lift border-green-500/40 bg-[#0F1714] shadow-[0_0_0_1px_rgba(74,222,128,0.15),0_24px_60px_rgba(0,0,0,0.4)] lg:-translate-y-2"
          : "card-interactive border-white/10 bg-[#0F1417]/85"
      }`}
    >
      {badge && (
        <span className="absolute -top-3 right-6 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-[#06120C] shadow-md">
          {badge}
        </span>
      )}

      <span
        className={`w-fit rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
          highlighted ? "bg-green-400/15 text-green-400" : "bg-white/5 text-neutral-400"
        }`}
      >
        {eyebrow}
      </span>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
        <p className="shrink-0 text-xl font-bold tracking-tight text-white">
          {price === 0 ? "0 kr" : `${price} kr`}
          {period && <span className="ml-1 text-sm font-normal text-neutral-500">/{period}</span>}
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-neutral-400">{description}</p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm text-neutral-300">
            <CheckIcon
              className={`mt-0.5 h-4 w-4 shrink-0 ${highlighted ? "text-green-400" : "text-neutral-500"}`}
            />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-1 flex-col justify-end gap-3">
        {error && <p className="text-sm text-red-400">{error}</p>}

        {priceKey ? (
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
              highlighted
                ? "bg-green-500 text-[#06120C] hover:bg-green-400 hover:shadow-[0_10px_30px_-8px_rgba(74,222,128,0.55)]"
                : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
            }`}
          >
            {loading ? "Skapar betalning..." : ctaLabel}
            {!loading && <ArrowRightIcon className="h-4 w-4" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={onFreeCta ?? onRequireAuth}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10"
          >
            {ctaLabel}
          </button>
        )}

        {caption && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-500">
            <LockIcon className="h-3.5 w-3.5" />
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}
