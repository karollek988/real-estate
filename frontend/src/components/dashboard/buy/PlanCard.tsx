"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { CheckIcon } from "@/components/icons";

interface PlanCardProps {
  eyebrow: string;
  title: string;
  description: string;
  price: number;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  priceKey?: string | null;
}

export function PlanCard({
  eyebrow,
  title,
  description,
  price,
  features,
  highlighted = false,
  badge,
  priceKey,
}: PlanCardProps) {
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
          ? "card-lift border-green-500/40 bg-[#0F1417]/95 shadow-[0_0_0_1px_rgba(74,222,128,0.15),0_24px_60px_rgba(0,0,0,0.4)] lg:-translate-y-2"
          : "card-interactive border-white/10 bg-[#0F1417]/85"
      }`}
    >
      {badge && (
        <span className="absolute -top-3 right-6 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white shadow-md">
          {badge}
        </span>
      )}

      <span
        className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
          highlighted ? "bg-green-400/15 text-green-400" : "bg-white/5 text-neutral-400"
        }`}
      >
        {eyebrow}
      </span>

      <h3 className="mt-3 text-lg font-semibold tracking-tight text-white">{title}</h3>
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

      <div className="mt-6 flex flex-1 flex-col justify-end gap-4">
        <p className="flex items-baseline gap-1">
          {price === 0 ? (
            <span className="text-2xl font-semibold tracking-tight text-white">Gratis</span>
          ) : (
            <>
              <span className="text-2xl font-semibold tracking-tight text-white">{price} kr</span>
              <span className="text-sm text-neutral-500">/månad</span>
            </>
          )}
        </p>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button
          variant={highlighted ? "primary" : "secondary"}
          className="w-full justify-center py-2.5 text-sm"
          onClick={handleCheckout}
          disabled={loading || !priceKey}
        >
          {loading ? "Skapar betalning..." : priceKey ? `Välj ${title}` : "Ingår"}
        </Button>
      </div>
    </div>
  );
}
