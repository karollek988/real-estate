"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ChevronRightIcon, TrendingUpIcon } from "@/components/icons";
import { ROUTES } from "@/components/site/navigation";

// Only actions with a real destination this sprint — "Lägg till bevakning",
// "Spara bostad" and "Hjälpcenter" had no destination (dead links) and were
// removed rather than pointed at placeholder pages.
export function QuickActionsCard() {
  const t = useTranslations("dashboard.quickActions");
  const router = useRouter();
  return (
    <div className="card-interactive rounded-2xl border border-ka-line-strong bg-white p-5 backdrop-blur-xl">
      <h3 className="text-sm font-semibold text-ka-ink">{t("title")}</h3>
      <div className="mt-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => router.push(ROUTES.skapaAnalys)}
          className="flex items-center justify-between rounded-xl px-2.5 py-2.5 text-sm text-ka-text transition hover:bg-ka-cream hover:text-ka-ink active:scale-[0.98]"
        >
          <span className="flex items-center gap-2.5">
            <TrendingUpIcon className="h-4 w-4 text-ka-muted" />
            {t("newAnalysis")}
          </span>
          <ChevronRightIcon className="h-4 w-4 text-ka-muted" />
        </button>
      </div>
    </div>
  );
}
