import { LockClosedBadgeIcon } from "@/components/icons";

const METHODS = ["Kort", "Swish", "Klarna"];

export function PaymentMethodsCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-400/10 text-green-400">
          <LockClosedBadgeIcon className="h-[18px] w-[18px]" />
        </span>
        <h3 className="text-sm font-semibold text-white">Tryggt och säkert</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
        All betalning hanteras säkert via Stripe.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {METHODS.map((method) => (
          <span
            key={method}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-neutral-300"
          >
            {method}
          </span>
        ))}
      </div>
    </div>
  );
}
