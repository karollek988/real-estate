"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { CheckIcon, HouseIcon } from "@/components/icons";

const REDIRECT_SECONDS = 5;

export default function ConfirmedPage() {
  const t = useTranslations("auth.confirmed");
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.push("/");
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ka-paper px-6">
      <div className="w-full max-w-md rounded-[24px] border border-ka-line-strong bg-white p-8 text-center shadow-ka-card-hover">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ka-sage">
          <CheckIcon className="h-8 w-8 text-ka-green-700" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-ka-ink">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ka-muted">{t("text", { seconds: secondsLeft })}</p>
        <Link
          href="/"
          className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-ka-green-900 py-3.5 text-base font-semibold text-white transition hover:bg-ka-green-800"
        >
          <HouseIcon className="h-5 w-5" />
          {t("button")}
        </Link>
      </div>
    </main>
  );
}
