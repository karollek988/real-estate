"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

interface UnlockButtonProps {
  analysisId: string;
}

export function UnlockButton({ analysisId }: UnlockButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey: "premium_analysis", unlockAnalysisId: analysisId }),
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
    <div className="flex flex-col items-center gap-3">
      <Button onClick={handleUnlock} disabled={loading} className="min-w-[200px] justify-center py-3 text-base">
        {loading ? "Skapar betalning..." : "Lås upp analys — betala"}
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
