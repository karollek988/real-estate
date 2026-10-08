import { useTranslations } from "next-intl";
import { LockIcon, ShieldIcon, ClipboardIcon } from "@/components/icons";
import { OMRADESANALYS_PRICE_SEK, TRYGGHETSPAKET_PRICE_SEK } from "@/lib/pricing";

/** The three small labels under the text. Their words: buy.hero.pills.<id> */
const PILLS = [
  { icon: ClipboardIcon, id: "oneOff" },
  { icon: ShieldIcon, id: "vat" },
  { icon: LockIcon, id: "secure" },
] as const;

export function BuyHero() {
  const t = useTranslations("buy.hero");
  return (
    <div>
      <h1 className="text-[32px] font-bold leading-[1.15] tracking-tight text-ka-ink sm:text-[40px]">
        {t.rich("title", {
          price: TRYGGHETSPAKET_PRICE_SEK,
          accent: (chunks) => (
            <span className="relative inline-block text-ka-green-700">
              {chunks}
              <span className="absolute inset-x-0 -bottom-1 h-[3px] rounded-full bg-ka-green-700/70" />
            </span>
          ),
        })}
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ka-text">
        {t("text", { areaPrice: OMRADESANALYS_PRICE_SEK })}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {PILLS.map(({ icon: Icon, id }) => (
          <span
            key={id}
            className="inline-flex items-center gap-2 rounded-full border border-ka-line-strong bg-white px-4 py-2 text-sm font-medium text-ka-text backdrop-blur-md"
          >
            <Icon className="h-4 w-4 text-ka-green-700" />
            {t(`pills.${id}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
