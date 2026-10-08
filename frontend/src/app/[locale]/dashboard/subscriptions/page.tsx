import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AnalysisBalanceCard } from "@/components/dashboard/buy/AnalysisBalanceCard";
import { ArrowRightIcon } from "@/components/icons";

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

// The route keeps its old name, but nothing here is a subscription any more:
// it is the account's balance plus a way to the buy page. The words: dashboard.purchases
export default function SubscriptionsPage() {
  const t = useTranslations("dashboard.purchases");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="dash-enter" style={stagger(0)}>
        <h1 className="text-2xl font-semibold tracking-tight text-ka-ink sm:text-[28px]">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ka-muted">{t("lead")}</p>
      </div>

      <div className="dash-enter" style={stagger(1)}>
        <AnalysisBalanceCard />
      </div>

      <div className="dash-enter" style={stagger(2)}>
        <Link
          href="/buy"
          className="inline-flex items-center gap-2 rounded-xl bg-ka-green-700 px-6 py-3 text-sm font-semibold text-ka-green-950 transition-all duration-200 hover:bg-ka-green-700"
        >
          {t("packages")}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
