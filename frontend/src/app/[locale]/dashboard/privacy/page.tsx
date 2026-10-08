"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ShieldIcon, MailIcon, CalendarIcon, InfoIcon } from "@/components/icons";
import { LOCALES, type AppLocale } from "@/i18n/locales";
import { useAuth } from "@/lib/auth/AuthProvider";
import { reopenCookieConsent } from "@/lib/consent";

interface SummaryData {
  totalAnalyses: number;
  memberSince: string;
}

export default function PrivacyPage() {
  const t = useTranslations("dashboard.privacy");
  const locale = useLocale() as AppLocale;
  const { user } = useAuth();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile/summary");
        if (res.ok) {
          const data = await res.json();
          setSummary({
            totalAnalyses: data.totalAnalyses ?? 0,
            memberSince: data.memberSince ?? null,
          });
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const displayName = (user?.user_metadata?.full_name as string | undefined) || null;
  const email = user?.email ?? null;
  const linkClass = "text-ka-green-700 underline underline-offset-4 transition hover:text-ka-green-800";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="dash-enter">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-ka-ink">
          <ShieldIcon className="h-6 w-6 text-ka-text" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ka-muted">
          {t.rich("lead", {
            link: (chunks) => (
              <Link href="/privacy" className={linkClass}>
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>

      <div className="dash-enter rounded-2xl border border-ka-line-strong bg-white p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ka-cream text-ka-text">
            <InfoIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-ka-ink">{t("account.title")}</h2>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm">
          {displayName && (
            <div className="flex items-center gap-2 text-ka-text">
              <span className="text-ka-muted">{t("account.name")}</span>
              <span className="text-ka-ink">{displayName}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2 text-ka-text">
              <MailIcon className="h-3.5 w-3.5 text-ka-muted" />
              <span className="text-ka-ink">{email}</span>
            </div>
          )}
          {summary?.memberSince && (
            <div className="flex items-center gap-2 text-ka-text">
              <CalendarIcon className="h-3.5 w-3.5 text-ka-muted" />
              <span>{t("account.created", { date: new Date(summary.memberSince).toLocaleDateString(LOCALES[locale].formatLocale) })}</span>
            </div>
          )}
          <p className="mt-1 text-ka-muted">{t("account.note")}</p>
        </div>
      </div>

      <div className="dash-enter rounded-2xl border border-ka-line-strong bg-white p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ka-cream text-ka-text">
            <ShieldIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-ka-ink">{t("analyses.title")}</h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ka-muted">
          {t.rich("analyses.text", {
            link: (chunks) => (
              <Link href="/dashboard" className={linkClass}>
                {chunks}
              </Link>
            ),
          })}
        </p>
        {summary && (
          <p className="mt-3 text-sm text-ka-muted">
            {t.rich("analyses.count", { count: summary.totalAnalyses, b: (chunks) => <span className="text-ka-ink">{chunks}</span> })}
          </p>
        )}
      </div>

      <div className="dash-enter rounded-2xl border border-ka-green-700/25 bg-ka-sage/40 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ka-sage/40 text-ka-green-700">
            <ShieldIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-ka-green-700">{t("never.title")}</h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ka-text">{t("never.text")}</p>
      </div>

      <div className="dash-enter rounded-2xl border border-ka-line-strong bg-white p-5 backdrop-blur-xl">
        <h2 className="text-sm font-semibold text-ka-ink">{t("cookies.title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ka-muted">{t("cookies.text")}</p>
        <div className="mt-4">
          <button
            type="button"
            onClick={reopenCookieConsent}
            className="cursor-pointer rounded-lg border border-ka-line-strong bg-ka-cream px-4 py-2 text-sm font-semibold text-ka-ink transition hover:bg-ka-sand"
          >
            {t("cookies.button")}
          </button>
        </div>
      </div>
    </div>
  );
}
