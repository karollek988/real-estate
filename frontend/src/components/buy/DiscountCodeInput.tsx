"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface DiscountCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  /** "light" on a white card, "onGreen" on the deep-green main package. */
  tone?: "light" | "onGreen";
}

export function DiscountCodeInput({ value, onChange, tone = "light" }: DiscountCodeInputProps) {
  const green = tone === "onGreen";
  const t = useTranslations("buy.discount");
  const [expanded, setExpanded] = useState(Boolean(value));

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`cursor-pointer text-left text-sm font-medium underline underline-offset-4 transition ${
          green ? "text-ka-mint hover:text-ka-mint-bright" : "text-ka-green-700 hover:text-ka-green-800"
        }`}
      >
        {t("ask")}
      </button>
    );
  }

  return (
    <div>
      <label htmlFor="discount-code" className={`text-sm font-medium ${green ? "text-white/80" : "text-ka-text"}`}>
        {t("label")}
      </label>
      <div className="relative mt-2">
        <input
          id="discount-code"
          type="text"
          placeholder={t("placeholder")}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className={`w-full rounded-xl border py-3 pl-4 pr-4 text-sm uppercase tracking-wide placeholder:normal-case outline-none transition focus:ring-4 ${
            green
              ? "border-white/15 bg-ka-ink/40 text-white placeholder:text-white/45 focus:border-ka-mint/60 focus:ring-ka-mint/10"
              : "border-ka-line-strong bg-white text-ka-ink placeholder:text-ka-muted focus:border-ka-green-700 focus:ring-ka-green-700/15"
          }`}
        />
      </div>
    </div>
  );
}
