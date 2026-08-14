"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseIcon, TicketIcon } from "@/components/icons";

interface DiscountCode {
  code: string;
  kind: "premium_analysis" | "premium_subscription";
  status: "active" | "reserved" | "redeemed";
}

interface CouponsResponse {
  enrolled: boolean;
  position?: number;
  popupShown?: boolean;
  codes?: DiscountCode[];
}

const KIND_LABEL: Record<DiscountCode["kind"], string> = {
  premium_analysis: "Premium-analys",
  premium_subscription: "Premium-prenumeration",
};

/**
 * Shown once, ever, per account — gated by campaign_enrollments.popup_shown_at
 * on the server (not localStorage), so it survives across devices/browsers.
 */
export function CampaignCouponPopup() {
  const router = useRouter();
  const [data, setData] = useState<CouponsResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/discount-codes")
      .then((res) => res.json())
      .then((json: CouponsResponse) => setData(json))
      .catch(() => {});
  }, []);

  const visible = !dismissed && data?.enrolled && data.popupShown === false && (data.codes?.length ?? 0) > 0;

  function dismiss() {
    setDismissed(true);
    fetch("/api/discount-codes", { method: "POST" }).catch(() => {});
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Du har fått rabattkoder"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#0F1417] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600/20">
            <TicketIcon className="h-6 w-6 text-green-400" />
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Stäng"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/5 hover:text-white"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <h2 className="mt-4 text-xl font-bold tracking-tight text-white">
          Grattis, du är användare #{data?.position}!
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          Du är en av våra första 100 användare och har fått 3 rabattkoder på 50% — två för
          Premium-analyser och en för en Premium-prenumeration.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {(data?.codes ?? []).map((code) => (
            <div
              key={code.code}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-2.5"
            >
              <span className="text-xs text-neutral-400">{KIND_LABEL[code.kind]}</span>
              <code className="text-sm font-semibold tracking-wide text-white">{code.code}</code>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            dismiss();
            router.push("/dashboard/coupons");
          }}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-green-600 py-3.5 text-base font-semibold text-white transition hover:bg-green-500"
        >
          Visa mina kuponger
        </button>
      </div>
    </div>
  );
}
