import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ShoppingBagIcon, ArrowRightIcon } from "@/components/icons";

export function StorePromoCard() {
  const t = useTranslations("dashboard.storePromo");
  return (
    <div className="card-interactive rounded-2xl border border-ka-line-strong bg-white p-5 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ka-sage/60 text-ka-green-700">
          <ShoppingBagIcon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-ka-ink">{t("title")}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ka-muted">{t("text")}</p>
        </div>
      </div>
      <Link
        href="/buy"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-ka-green-900 px-6 py-2.5 text-sm font-semibold tracking-tight text-white transition-all duration-200 hover:bg-ka-green-800 hover:shadow-ka-card-hover active:scale-[0.98] active:shadow-none"
      >
        {t("cta")}
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}
