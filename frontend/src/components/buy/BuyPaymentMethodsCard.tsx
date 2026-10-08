import { useTranslations } from "next-intl";
import { ShieldIcon, VisaIcon, MastercardIcon, KlarnaIcon } from "@/components/icons";

export function BuyPaymentMethodsCard() {
  const t = useTranslations("buy.payment");
  return (
    <div className="rounded-2xl border border-ka-line-strong bg-white p-5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ka-sage/60 text-ka-green-700">
          <ShieldIcon className="h-[18px] w-[18px]" />
        </span>
        <h3 className="text-sm font-semibold text-ka-ink">{t("title")}</h3>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4" role="list" aria-label={t("label")}>
        <VisaIcon role="img" aria-label="Visa" className="h-5 w-auto text-ka-ink" />
        <MastercardIcon role="img" aria-label="Mastercard" className="h-6 w-auto" />
        <KlarnaIcon role="img" aria-label="Klarna" className="h-6 w-auto" />
      </div>
    </div>
  );
}
