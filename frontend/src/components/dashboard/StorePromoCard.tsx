import Link from "next/link";
import { ShoppingBagIcon, ArrowRightIcon } from "@/components/icons";

export function StorePromoCard() {
  return (
    <div className="card-interactive rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-400/10 text-green-400">
          <ShoppingBagIcon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-white">Behöver du fler analyser?</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">
            Köp en enskild Decision Analysis eller spara pengar med ett paket.
          </p>
        </div>
      </div>
      <Link
        href="/buy"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold tracking-tight text-white transition-all duration-200 hover:bg-green-500 hover:shadow-[0_6px_24px_-6px_rgba(74,222,128,0.5)] active:scale-[0.98] active:shadow-none"
      >
        Öppna Decision Analysis Store
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  );
}
