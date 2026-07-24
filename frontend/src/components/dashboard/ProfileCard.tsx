import Link from "next/link";
import { Button } from "@/components/Button";
import { MailIcon, CalendarIcon, ChevronRightIcon, BadgeCheckIcon } from "@/components/icons";

interface ProfileCardProps {
  name: string;
  email: string;
  memberSince: string;
  initials: string;
  premium?: boolean;
}

// No real subscription-tier data exists yet (only per-analysis quotas —
// see the 4 profile stat cards), so this never fabricates a "Premium-medlem"
// badge unless a caller explicitly knows the user's plan.
export function ProfileCard({ name, email, memberSince, initials, premium = false }: ProfileCardProps) {
  return (
    <div className="card-interactive rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-3.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-green-500/30 bg-green-400/10 text-lg font-semibold text-green-400">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white">{name}</p>
          {premium && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-green-400">
              Premium-medlem <BadgeCheckIcon className="h-4 w-4" />
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2.5 text-sm text-neutral-300">
          <CalendarIcon className="h-4 w-4 shrink-0 text-neutral-500" />
          <div>
            <p className="text-xs text-neutral-500">Medlem sedan</p>
            <p className="text-white">{memberSince}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-neutral-300">
          <MailIcon className="h-4 w-4 shrink-0 text-neutral-500" />
          <div className="min-w-0">
            <p className="text-xs text-neutral-500">E-post</p>
            <p className="truncate text-white">{email}</p>
          </div>
        </div>
      </div>

      <Link href="/dashboard/settings" className="mt-5 block">
        <Button
          variant="secondary"
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm"
        >
          Redigera profil
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
