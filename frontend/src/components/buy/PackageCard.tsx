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

      <h3 className="text-lg font-semibold tracking-tight text-white">{name}</h3>

      <p className="mt-3 text-4xl font-bold tracking-tight text-white">{tPackages("priceInline", { price })}</p>
      <p className="mt-1 text-sm text-neutral-400">{t("priceNote", { note: priceNote })}</p>

      <p className="mt-4 text-sm leading-relaxed text-neutral-300">{summary}</p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {includes.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-neutral-200">
            <CheckIcon
              className={`mt-0.5 h-4 w-4 shrink-0 ${highlighted ? "text-green-400" : "text-neutral-500"}`}
            />
            {item}
          </li>
        ))}
      </ul>

      {valueNote && (
        <p
          className={`mt-5 rounded-lg px-3 py-2 text-[13px] font-medium leading-snug ${
            highlighted ? "bg-green-500/10 text-green-300" : "bg-white/5 text-neutral-300"
          }`}
        >
          {valueNote}
        </p>
      )}

      <div className="mt-6 flex flex-1 flex-col justify-end gap-3">
        {acceptsDiscountCode && <DiscountCodeInput value={discountCode} onChange={setDiscountCode} />}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
            highlighted
              ? "bg-green-500 text-[#06120C] hover:bg-green-400 hover:shadow-[0_10px_30px_-8px_rgba(74,222,128,0.55)]"
              : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
          }`}
        >
          {loading ? t("creating") : ctaLabel}
          {!loading && <ArrowRightIcon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
