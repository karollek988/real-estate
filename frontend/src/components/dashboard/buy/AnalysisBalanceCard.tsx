"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, BuildingIcon, MapPinIcon, WalletIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isDevAdmin } from "@/lib/auth/devAdmin";
import type { ProfileSummary } from "@/lib/analysis/ownership";

/**
 * The account's balance and what it holds, in one card: how many analyses the
 * user can still start (credits, per product) and how many of each kind they
 * already have. Used on the buy page, the dashboard overview and
 * "Köp & saldo", so the numbers are the same everywhere.
 */

type Summary = Pick<ProfileSummary, "credits" | "analyses">;

function Row({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-400/10 text-green-400 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-neutral-200">{label}</p>
          {hint && <p className="text-xs text-neutral-500">{hint}</p>}
        </div>
      </div>
      <span className="text-lg font-semibold tabular-nums text-white">{value}</span>
    </div>
  );
}

export function AnalysisBalanceCard({ showBuyLink = true }: { showBuyLink?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const devAdmin = isDevAdmin(user?.email);
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/summary");
      if (res.ok) {
        const data: Summary = await res.json();
        setSummary({ credits: data.credits, analyses: data.analyses });
      }
    } catch {
      // Ignore — the card simply keeps showing dashes.
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const signedOut = !authLoading && !user;
  const num = (value: number | undefined) => (devAdmin ? "∞" : value !== undefined ? String(value) : "—");

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Ditt saldo</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-400/10 text-green-400">
          <WalletIcon className="h-[18px] w-[18px]" />
        </span>
      </div>

      {signedOut ? (
        <p className="mt-4 text-sm text-neutral-400">Logga in för att se ditt saldo.</p>
      ) : (
        <>
          {devAdmin && <p className="mt-2 text-xs font-medium text-amber-300">Obegränsat · Dev account</p>}

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Kvar att använda</p>
          <div className="divide-y divide-white/5">
            <Row
              icon={<BuildingIcon />}
              label="Trygghetspaket"
              hint="BRF, område och dolda kostnader för en bostad"
              value={num(summary?.credits.full)}
            />
            <Row icon={<MapPinIcon />} label="Områdesanalyser" value={num(summary?.credits.area)} />
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Dina analyser</p>
          <div className="divide-y divide-white/5">
            <Row icon={<BuildingIcon />} label="BRF-analyser" value={String(summary?.analyses.brf ?? "—")} />
            <Row icon={<MapPinIcon />} label="Områdesanalyser" value={String(summary?.analyses.area ?? "—")} />
            <Row icon={<WalletIcon />} label="Dolda kostnader" value={String(summary?.analyses.hiddenCosts ?? "—")} />
          </div>

          {showBuyLink && (
            <Link
              href="/buy"
              className="mt-4 flex items-center gap-1 text-sm font-medium text-green-400 transition hover:text-green-300"
            >
              Köp fler analyser
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          )}
        </>
      )}
    </div>
  );
}
