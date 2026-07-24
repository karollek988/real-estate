"use client";

import { useCallback, useEffect, useState } from "react";
import { WalletIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isDevAdmin } from "@/lib/auth/devAdmin";

export function AnalysisBalanceCard() {
  const { user } = useAuth();
  const devAdmin = isDevAdmin(user?.email);
  const [balance, setBalance] = useState<number | null>(null);
  const [previewsRemaining, setPreviewsRemaining] = useState<number | null>(null);
  const [previewsTotal] = useState(3);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/summary");
      if (res.ok) {
        const data = await res.json();
        setBalance(data.premiumRemaining);
        setPreviewsRemaining(data.freeRemaining);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">Ditt Decision Analysis-saldo</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-400/10 text-green-400">
          <WalletIcon className="h-[18px] w-[18px]" />
        </span>
      </div>
      {devAdmin ? (
        <>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-white">∞</p>
          <p className="mt-1 text-sm font-medium text-amber-300">
            Unlimited Premium · Dev account
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
            {balance !== null ? balance : "—"}
          </p>
          {previewsRemaining !== null && previewsRemaining > 0 && (
            <p className="mt-1 text-sm font-medium text-green-400">
              {previewsRemaining} av {previewsTotal} gratis Decision Previews kvar denna månad
            </p>
          )}
        </>
      )}
    </div>
  );
}
