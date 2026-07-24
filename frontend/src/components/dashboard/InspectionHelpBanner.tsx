"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { ShieldIcon, ArrowRightIcon } from "@/components/icons";

export function InspectionHelpBanner() {
  const router = useRouter();
  return (
    <div className="card-lift flex flex-col items-start gap-5 rounded-2xl border border-amber-400/15 bg-gradient-to-r from-amber-400/[0.06] to-transparent p-6 hover:border-amber-400/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
          <ShieldIcon className="h-6 w-6" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-white">Behöver du hjälp inför en besiktning?</h3>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-neutral-400">
            Vår besiktningsassistent hjälper dig att förstå bostadens skick innan du lägger bud. Få en
            grundlig genomgång av risker och dolda fel.
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        className="flex shrink-0 items-center gap-2 whitespace-nowrap"
        onClick={() => router.push("/dashboard/inspection")}
      >
        Till besiktningshjälp
        <ArrowRightIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
