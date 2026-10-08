"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ka-sage/60 text-ka-green-700 [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-ka-text">{label}</p>
          {hint && <p className="text-xs text-ka-muted">{hint}</p>}
        </div>
      </div>
      <span className="text-lg font-semibold tabular-nums text-ka-ink">{value}</span>
    </div>
  );
}

export function AnalysisBalanceCard({ showBuyLink = true }: { showBuyLink?: boolean }) {
  const t = useTranslations("balance");
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
    <div className="rounded-2xl border border-ka-line-strong bg-white p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ka-ink">{t("title")}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ka-sage/60 text-ka-green-700">
          <WalletIcon className="h-[18px] w-[18px]" />
        </span>
      </div>

      {signedOut ? (
        <p className="mt-4 text-sm text-ka-muted">{t("signedOut")}</p>
      ) : (
        <>
          {devAdmin && <p className="mt-2 text-xs font-medium text-ka-amber-700">{t("unlimited")}</p>}

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ka-muted">{t("remaining")}</p>
          <div className="divide-y divide-white/5">
            <Row
              icon={<BuildingIcon />}
              label={t("full.label")}
              hint={t("full.hint")}
              value={num(summary?.credits.full)}
            />
            <Row icon={<MapPinIcon />} label={t("areaCredits")} value={num(summary?.credits.area)} />
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ka-muted">{t("yours")}</p>
          <div className="divide-y divide-white/5">
            <Row icon={<BuildingIcon />} label={t("brf")} value={String(summary?.analyses.brf ?? "—")} />
            <Row icon={<MapPinIcon />} label={t("area")} value={String(summary?.analyses.area ?? "—")} />
            <Row icon={<WalletIcon />} label={t("hiddenCosts")} value={String(summary?.analyses.hiddenCosts ?? "—")} />
          </div>

          {showBuyLink && (
            <Link
              href="/buy"
              className="mt-4 flex items-center gap-1 text-sm font-medium text-ka-green-700 transition hover:text-ka-green-800"
            >
              {t("buyMore")}
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          )}
        </>
      )}
    </div>
  );
}
