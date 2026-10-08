"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DiscountCodeInput } from "@/components/buy/DiscountCodeInput";
import { CheckIcon, ArrowRightIcon } from "@/components/icons";

interface PackageCardProps {
  name: string;
  price: number;
  /** What the price covers, e.g. "en bostad". */
  priceNote: string;
  summary: string;
  includes: string[];
  /** One line under the list that helps the buyer judge the price. */
  valueNote?: string;
  badge?: string;
  highlighted?: boolean;
  ctaLabel: string;
  priceKey: "omradesanalys" | "trygghetspaket" | "tre_bostader";
  acceptsDiscountCode?: boolean;
  onRequireAuth: () => void;
}

export function PackageCard({
  name,
  price,
  priceNote,
  summary,
  includes,
  valueNote,
  badge,
  highlighted = false,
  ctaLabel,
  priceKey,
  acceptsDiscountCode = false,
  onRequireAuth,
}: PackageCardProps) {
  const t = useTranslations("buy.card");
  const tPackages = useTranslations("packages");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState("");

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // the language of the page: the payment page (Stripe) opens in it and sends the buyer back to it
        body: JSON.stringify({
          priceKey,
          locale,
          ...(acceptsDiscountCode && discountCode.trim() ? { discountCode: discountCode.trim() } : {}),
        }),
      });
      if (res.status === 401) {
        onRequireAuth();
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? t("error"));
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError(t("genericError"));
    } finally {
      setLoading(false);
    }
  }

  // The main package is the deep-green card, as on the pricing section of the site; the others are white.
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        highlighted
          ? "card-lift border-ka-green-950 bg-ka-green-950 text-white shadow-ka-panel lg:-translate-y-2"
          : "card-interactive border-ka-line-strong bg-white shadow-ka-card"
      }`}
    >
      {badge && (
        <span className="absolute -top-3 right-6 rounded-full bg-ka-mint px-3 py-1 text-xs font-bold text-ka-green-950">
          {badge}
        </span>
      )}

      <h3 className={`text-lg font-semibold tracking-tight ${highlighted ? "text-white" : "text-ka-ink"}`}>{name}</h3>

      <p className={`mt-3 text-4xl font-bold tracking-tight ${highlighted ? "text-white" : "text-ka-ink"}`}>
        {tPackages("priceInline", { price })}
      </p>
      <p className={`mt-1 text-sm ${highlighted ? "text-white/60" : "text-ka-muted"}`}>{t("priceNote", { note: priceNote })}</p>

      <p className={`mt-4 text-sm leading-relaxed ${highlighted ? "text-white/80" : "text-ka-text"}`}>{summary}</p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {includes.map((item) => (
          <li key={item} className={`flex items-start gap-2.5 text-sm ${highlighted ? "text-white/90" : "text-ka-text"}`}>
            <CheckIcon className={`mt-0.5 h-4 w-4 shrink-0 ${highlighted ? "text-ka-mint" : "text-ka-green-700"}`} />
            {item}
          </li>
        ))}
      </ul>

      {valueNote && (
        <p
          className={`mt-5 rounded-lg px-3 py-2 text-[13px] font-medium leading-snug ${
            highlighted ? "bg-white/10 text-ka-mint" : "bg-ka-cream text-ka-green-700"
          }`}
        >
          {valueNote}
        </p>
      )}

      <div className="mt-6 flex flex-1 flex-col justify-end gap-3">
        {acceptsDiscountCode && <DiscountCodeInput value={discountCode} onChange={setDiscountCode} tone={highlighted ? "onGreen" : "light"} />}

        {error && <p className={`text-sm ${highlighted ? "text-ka-coral-300" : "text-ka-red-600"}`}>{error}</p>}

        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
            highlighted
              ? "bg-ka-cream text-ka-green-950 hover:bg-white"
              : "border border-ka-line-strong bg-ka-cream text-ka-ink hover:bg-ka-sand"
          }`}
        >
          {loading ? t("creating") : ctaLabel}
          {!loading && <ArrowRightIcon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
