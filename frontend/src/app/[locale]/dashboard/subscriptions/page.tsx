import Link from "next/link";
import { AnalysisBalanceCard } from "@/components/dashboard/buy/AnalysisBalanceCard";
import { ArrowRightIcon } from "@/components/icons";

const stagger = (n: number) => ({ "--dash-stagger": n }) as React.CSSProperties;

// The route keeps its old name, but nothing here is a subscription any more:
// it is the account's balance plus a way to the buy page.
export default function SubscriptionsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="dash-enter" style={stagger(0)}>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">Köp &amp; saldo</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Se hur många analyser du har kvar och vad som finns på kontot. Köp en Områdesanalys eller ett
          Trygghetspaket när du behöver fler.
        </p>
      </div>

      <div className="dash-enter" style={stagger(1)}>
        <AnalysisBalanceCard />
      </div>

      <div className="dash-enter" style={stagger(2)}>
        <Link
          href="/buy"
          className="inline-flex items-center gap-2 rounded-xl bg-green-500 px-6 py-3 text-sm font-semibold text-[#06120C] transition-all duration-200 hover:bg-green-400"
        >
          Se paketen
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
