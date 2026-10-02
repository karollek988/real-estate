import { LockIcon, ShieldIcon, ClipboardIcon } from "@/components/icons";
import { OMRADESANALYS_PRICE_SEK, TRYGGHETSPAKET_PRICE_SEK } from "@/lib/pricing";

const PILLS = [
  { icon: ClipboardIcon, label: "Engångsköp – inget abonnemang" },
  { icon: ShieldIcon, label: "Alla priser inkl. moms" },
  { icon: LockIcon, label: "Säker betalning via Stripe" },
];

export function BuyHero() {
  return (
    <div>
      <h1 className="text-[32px] font-bold leading-[1.15] tracking-tight text-white sm:text-[40px]">
        Kartan är gratis.{" "}
        <span className="relative inline-block text-green-400">
          Tryggheten
          <span className="absolute inset-x-0 -bottom-1 h-[3px] rounded-full bg-green-500/70" />
        </span>{" "}
        kostar {TRYGGHETSPAKET_PRICE_SEK}&nbsp;kr.
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-300">
        Ett bostadsköp är ofta det största du gör. Trygghetspaketet visar det som annonsen inte
        gör: hur föreningens ekonomi ser ut, hur området ser ut och vad bostaden kostar att äga.
        Vill du bara se området runt en bostad räcker en Områdesanalys för {OMRADESANALYS_PRICE_SEK}&nbsp;kr.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {PILLS.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm font-medium text-neutral-200 backdrop-blur-md"
          >
            <Icon className="h-4 w-4 text-green-400" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
