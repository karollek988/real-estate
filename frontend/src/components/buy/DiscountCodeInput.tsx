"use client";

import { useState } from "react";

interface DiscountCodeInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function DiscountCodeInput({ value, onChange }: DiscountCodeInputProps) {
  const [expanded, setExpanded] = useState(Boolean(value));

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="cursor-pointer text-left text-sm font-medium text-green-400 underline underline-offset-4 transition hover:text-green-300"
      >
        Har du en rabattkod?
      </button>
    );
  }

  return (
    <div>
      <label htmlFor="discount-code" className="text-sm font-medium text-neutral-200">
        Rabattkod
      </label>
      <div className="relative mt-2">
        <input
          id="discount-code"
          type="text"
          placeholder="KOP-XXXXX-XXXXX"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-4 pr-4 text-sm uppercase tracking-wide text-white placeholder:text-neutral-500 placeholder:normal-case outline-none transition focus:border-green-500/60 focus:ring-4 focus:ring-green-500/10"
        />
      </div>
    </div>
  );
}
