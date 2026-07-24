import { WalletIcon, ShieldIcon, LockClosedBadgeIcon } from "@/components/icons";

const ITEMS = [
  {
    icon: WalletIcon,
    title: "Ingen bindningstid",
    description: "Avsluta eller ändra ditt paket när du vill.",
  },
  {
    icon: ShieldIcon,
    title: "Pengarna tillbaka",
    description: "Nöjd-kund-garanti inom 14 dagar.",
  },
  {
    icon: LockClosedBadgeIcon,
    title: "Säker betalning",
    description: "Vi använder Stripe för säker betalning.",
  },
];

export function TrustStrip() {
  return (
    <div className="grid grid-cols-1 gap-6 border-t border-white/10 pt-8 sm:grid-cols-3">
      {ITEMS.map(({ icon: Icon, title, description }) => (
        <div key={title} className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-neutral-300">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-0.5 text-sm text-neutral-400">{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
