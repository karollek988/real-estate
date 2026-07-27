import { ShieldIcon, VisaIcon, MastercardIcon, SwishIcon, KlarnaIcon } from "@/components/icons";

export function BuyPaymentMethodsCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-400/10 text-green-400">
          <ShieldIcon className="h-[18px] w-[18px]" />
        </span>
        <h3 className="text-sm font-semibold text-white">Säker &amp; krypterad betalning</h3>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4" role="list" aria-label="Betalningsmetoder">
        <VisaIcon role="img" aria-label="Visa" className="h-5 w-auto text-white" />
        <MastercardIcon role="img" aria-label="Mastercard" className="h-6 w-auto" />
        <SwishIcon role="img" aria-label="Swish" className="h-6 w-auto text-white" />
        <KlarnaIcon role="img" aria-label="Klarna" className="h-6 w-auto" />
      </div>
    </div>
  );
}
