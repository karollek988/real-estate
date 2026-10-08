"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/Button";
import { ShieldIcon, ArrowRightIcon } from "@/components/icons";

export function InspectionHelpBanner() {
  const t = useTranslations("dashboard.inspectionBanner");
  const router = useRouter();
  return (
    <div className="card-lift flex flex-col items-start gap-5 rounded-2xl border border-ka-green-700/20 bg-gradient-to-r from-ka-sage/50 to-transparent p-6 hover:border-ka-green-700/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ka-sage/60 text-ka-green-700">
          <ShieldIcon className="h-6 w-6" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-ka-ink">{t("title")}</h3>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ka-muted">{t("text")}</p>
        </div>
      </div>
      <Button
        tone="light"
        variant="primary"
        className="flex shrink-0 items-center gap-2 whitespace-nowrap"
        onClick={() => router.push("/dashboard/inspection")}
      >
        {t("cta")}
        <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
