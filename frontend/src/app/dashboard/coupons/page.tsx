"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TicketIcon, CheckIcon, ClipboardIcon } from "@/components/icons";
import { EmptyState } from "@/components/dashboard/EmptyState";

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

interface DiscountCode {
  code: string;
  kind: "premium_analysis" | "premium_subscription";
  status: "active" | "reserved" | "redeemed";
}

interface CouponsResponse {
  enrolled: boolean;
  position?: number;
  codes?: DiscountCode[];
}

const KIND_LABEL: Record<DiscountCode["kind"], string> = {
  premium_analysis: "50% rabatt på en Premium-analys",
  premium_subscription: "50% rabatt på en Premium-prenumeration",
};

const STATUS_STYLE: Record<DiscountCode["status"], string> = {
  active: "bg-green-400/10 text-green-400 border-green-400/20",
  reserved: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  redeemed: "bg-white/5 text-neutral-400 border-white/10",
};

const STATUS_LABEL: Record<DiscountCode["status"], string> = {
  active: "Aktiv",
  reserved: "Reserverad",
  redeemed: "Använd",
};

function CouponCard({ code, index }: { code: DiscountCode; index: number }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="dash-enter rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl"
      style={stagger(index + 1)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{KIND_LABEL[code.kind]}</p>
          <span
            className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-tight ${STATUS_STYLE[code.status]}`}
          >
            {STATUS_LABEL[code.status]}
          </span>
        </div>
        <TicketIcon className="h-5 w-5 shrink-0 text-green-400" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm font-semibold tracking-wide text-white">
          {code.code}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          disabled={code.status !== "active"}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-neutral-300 transition hover:border-green-500/60 hover:text-green-400 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Kopiera kod"
        >
          {copied ? <CheckIcon className="h-4 w-4 text-green-400" /> : <ClipboardIcon className="h-4 w-4" />}
        </button>
      </div>
      {code.status === "reserved" && (
        <p className="mt-2 text-xs text-neutral-500">Koden är reserverad för en pågående betalning.</p>
      )}
      {code.status === "redeemed" && <p className="mt-2 text-xs text-neutral-500">Koden har redan använts.</p>}
    </div>
  );
}

export default function CouponsPage() {
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
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-white">
          <TicketIcon className="h-6 w-6 text-neutral-300" />
          Kuponger
        </h1>
        <p className="mt-1 text-sm text-neutral-400">Dina rabattkoder från First 100 Users-kampanjen.</p>
      </div>

      {loading ? null : data?.enrolled ? (
        <>
          <div
            className="dash-enter rounded-2xl border border-green-400/20 bg-green-400/[0.04] p-5 backdrop-blur-xl"
            style={stagger(1)}
          >
            <p className="text-sm text-neutral-200">
              Du är användare <span className="font-semibold text-green-400">#{data.position}</span> av våra
              första 100 användare — därför fick du 3 rabattkoder på 50%.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(data.codes ?? []).map((code, i) => (
              <CouponCard key={code.code} code={code} index={i} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="Inga kuponger just nu"
          description="Du är inte en av våra första 100 användare, men håll utkik efter framtida kampanjer."
          actionLabel="Köp en analys"
          onAction={() => router.push("/buy")}
        />
      )}
    </div>
  );
}
