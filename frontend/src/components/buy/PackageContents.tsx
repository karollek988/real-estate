import { useTranslations } from "next-intl";
import { BuildingIcon, MapPinIcon, WalletIcon, CheckIcon } from "@/components/icons";
import { HUSBESIKTNING_REFERENCE_PRICE_SEK, TRYGGHETSPAKET_PRICE_SEK } from "@/lib/pricing";
import { HOUSING_COST_LIVE } from "@/lib/packages";

// Each analysis is introduced by the question a buyer is actually asking, so
// the package reads as "what do I find out" rather than a list of features.
// The words: buy.contents.<id>.name / .question / .points.<point>
const ANALYSES = [
  { icon: BuildingIcon, id: "brf", points: ["brf.points.debt", "brf.points.meaning", "brf.points.plans", "brf.points.review"] },
  { icon: MapPinIcon, id: "area", points: ["area.points.services", "area.points.safety", "area.points.development", "area.points.automatic"] },
  { icon: WalletIcon, id: "hidden", points: ["hidden.points.loans", HOUSING_COST_LIVE ? "hidden.points.calc" : "hidden.points.calcSoon"] },
] as const;

export function PackageContents() {
  const t = useTranslations("buy.contents");
  return (
    <section>
      <h2 className="text-2xl font-bold tracking-tight text-white">{t("title")}</h2>
      <p className="mt-1 text-sm text-neutral-400">{t("text")}</p>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        {ANALYSES.map(({ icon: Icon, id, points }) => (
          <div key={id} className="rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-400/10 text-green-400">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-white">{t(`${id}.name`)}</h3>
            <p className="mt-1 text-sm font-medium text-green-300">{t(`${id}.question`)}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-sm text-neutral-300">
                  <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                  {t(point)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("compare.label")}</p>
        <p className="mt-2 text-lg font-semibold text-white">{t("compare.price", { price: HUSBESIKTNING_REFERENCE_PRICE_SEK })}</p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          {t("compare.text", { packagePrice: TRYGGHETSPAKET_PRICE_SEK })}
        </p>
        <p className="mt-2 text-xs text-neutral-500">{t("compare.source")}</p>
      </div>
    </section>
  );
}
