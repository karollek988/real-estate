"use client";

import { useRouter } from "next/navigation";
import { ChevronRightIcon, TrendingUpIcon } from "@/components/icons";

// Only actions with a real destination this sprint — "Lägg till bevakning",
// "Spara bostad" and "Hjälpcenter" had no destination (dead links) and were
// removed rather than pointed at placeholder pages.
export function QuickActionsCard() {
  const router = useRouter();
  return (
    <div className="card-interactive rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
      <h3 className="text-sm font-semibold text-white">Snabbåtkomst</h3>
      <div className="mt-3 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center justify-between rounded-xl px-2.5 py-2.5 text-sm text-neutral-300 transition hover:bg-white/5 hover:text-white active:scale-[0.98]"
        >
          <span className="flex items-center gap-2.5">
            <TrendingUpIcon className="h-4 w-4 text-neutral-500" />
            Skapa ny prisanalys
          </span>
          <ChevronRightIcon className="h-4 w-4 text-neutral-600" />
        </button>
      </div>
    </div>
  );
}
