import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/Button";
import { MailIcon, CalendarIcon, ChevronRightIcon } from "@/components/icons";

interface ProfileCardProps {
  name: string;
  email: string;
  memberSince: string;
  initials: string;
}

export function ProfileCard({ name, email, memberSince, initials }: ProfileCardProps) {
  const t = useTranslations("dashboard.profile");
  return (
    <div className="card-interactive rounded-2xl border border-ka-line-strong bg-white p-5 backdrop-blur-xl">
      <div className="flex items-center gap-3.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-ka-green-700/30 bg-ka-sage/60 text-lg font-semibold text-ka-green-700">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ka-ink">{name}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-ka-line-strong pt-4">
        <div className="flex items-center gap-2.5 text-sm text-ka-text">
          <CalendarIcon className="h-4 w-4 shrink-0 text-ka-muted" />
          <div>
            <p className="text-xs text-ka-muted">{t("memberSince")}</p>
            <p className="text-ka-ink">{memberSince}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-sm text-ka-text">
          <MailIcon className="h-4 w-4 shrink-0 text-ka-muted" />
          <div className="min-w-0">
            <p className="text-xs text-ka-muted">{t("email")}</p>
            <p className="truncate text-ka-ink">{email}</p>
          </div>
        </div>
      </div>

      <Link href="/dashboard/settings" className="mt-5 block">
        <Button
          tone="light"
          variant="secondary"
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm"
        >
          {t("edit")}
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
