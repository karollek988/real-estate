"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { TicketIcon, CheckIcon, ClipboardIcon } from "@/components/icons";
import { EmptyState } from "@/components/dashboard/EmptyState";

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

interface DiscountCode {
  code: string;
  kind: "trygghetspaket" | "omradesanalys";
  status: "active" | "reserved" | "redeemed";
}

interface CouponsResponse {
  codes?: DiscountCode[];
}

const STATUS_STYLE: Record<DiscountCode["status"], string> = {
  active: "bg-ka-sage/60 text-ka-green-700 border-ka-green-700/25",
  reserved: "bg-ka-amber-100 text-ka-amber-700 border-ka-amber-300",
  redeemed: "bg-ka-cream text-ka-muted border-ka-line-strong",
};

function CouponCard({ code, index }: { code: DiscountCode; index: number }) {
  const t = useTranslations("dashboard.coupons");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="dash-enter rounded-2xl border border-ka-line-strong bg-white p-5 backdrop-blur-xl"
      style={stagger(index + 1)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ka-ink">{t(`kind.${code.kind}`)}</p>
          <span
            className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-tight ${STATUS_STYLE[code.status]}`}
          >
            {t(`status.${code.status}`)}
          </span>
        </div>
        <TicketIcon className="h-5 w-5 shrink-0 text-ka-green-700" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 rounded-xl border border-ka-line-strong bg-white px-4 py-2.5 text-sm font-semibold tracking-wide text-ka-ink">
          {code.code}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          disabled={code.status !== "active"}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-ka-line-strong bg-white text-ka-text transition hover:border-ka-green-700 hover:text-ka-green-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("copy")}
        >
          {copied ? <CheckIcon className="h-4 w-4 text-ka-green-700" /> : <ClipboardIcon className="h-4 w-4" />}
        </button>
      </div>
      {code.status === "reserved" && <p className="mt-2 text-xs text-ka-muted">{t("reservedNote")}</p>}
      {code.status === "redeemed" && <p className="mt-2 text-xs text-ka-muted">{t("redeemedNote")}</p>}
    </div>
  );
}

export default function CouponsPage() {
  const t = useTranslations("dashboard.coupons");
  const router = useRouter();
  const [data, setData] = useState<CouponsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/discount-codes")
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="dash-enter" style={stagger(0)}>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-ka-ink">
          <TicketIcon className="h-6 w-6 text-ka-text" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-ka-muted">{t("lead")}</p>
      </div>

      {loading ? null : (data?.codes?.length ?? 0) > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(data?.codes ?? []).map((code, i) => (
            <CouponCard key={code.code} code={code} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.text")}
          actionLabel={t("empty.action")}
          onAction={() => router.push("/buy")}
        />
      )}
    </div>
  );
}
