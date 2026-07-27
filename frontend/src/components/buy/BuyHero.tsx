import { ZapIcon, ChartIcon, ClipboardIcon } from "@/components/icons";

const PILLS = [
  { icon: ZapIcon, label: "Snabb leverans" },
  { icon: ChartIcon, label: "Datadriven analys" },
  { icon: ClipboardIcon, label: "Fullt beslutsunderlag" },
];

export function BuyHero() {
  return (
    <div>
      <h1 className="text-[32px] font-bold leading-[1.15] tracking-tight text-white sm:text-[40px]">
        Köp din{" "}
        <span className="relative inline-block text-green-400">
          beslutsanalys
          <span className="absolute inset-x-0 -bottom-1 h-[3px] rounded-full bg-green-500/70" />
        </span>
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-neutral-300">
        Fatta ett tryggare bostadsbeslut. Våra analyser ger dig hela beslutsunderlaget — så att
        du kan köpa med kunskap, inte magkänsla.
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
