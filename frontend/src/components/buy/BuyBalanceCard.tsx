"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCardIcon, InfoIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isDevAdmin } from "@/lib/auth/devAdmin";

export function BuyBalanceCard() {
  const { user, loading: authLoading } = useAuth();
  const devAdmin = isDevAdmin(user?.email);
  const [balance, setBalance] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/summary");
      if (res.ok) {
        const data = await res.json();
        setBalance(data.premiumRemaining);
      }
    } catch {
      // Ignore — balance simply won't show
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-neutral-400">
          Ditt analys-saldo
          <InfoIcon className="h-3.5 w-3.5 text-neutral-500" />
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-400/10 text-green-400">
          <CreditCardIcon className="h-[18px] w-[18px]" />
        </span>
      </div>

      {!authLoading && !user ? (
        <>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-white">—</p>
          <p className="mt-1 text-sm text-neutral-400">Logga in för att se ditt saldo</p>
        </>
      ) : devAdmin ? (
        <>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-white">∞</p>
          <p className="mt-1 text-sm font-medium text-amber-300">Unlimited Premium · Dev account</p>
        </>
      ) : (
        <>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
            {balance !== null ? balance : "—"}
          </p>
          <p className="mt-1 text-sm text-neutral-400">analyser kvar</p>
        </>
      )}
    </div>
  );
}
