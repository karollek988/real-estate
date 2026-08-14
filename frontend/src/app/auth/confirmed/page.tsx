"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, HouseIcon } from "@/components/icons";

const REDIRECT_SECONDS = 5;

export default function ConfirmedPage() {
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
    <main className="flex min-h-screen items-center justify-center bg-[#0A0F0D] px-6">
      <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#0F1417] p-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-600/20">
          <CheckIcon className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">
          E-postadressen är bekräftad!
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          Ditt konto är nu aktiverat. Du skickas till startsidan om {secondsLeft}{" "}
          {secondsLeft === 1 ? "sekund" : "sekunder"}.
        </p>
        <Link
          href="/"
          className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-green-600 py-3.5 text-base font-semibold text-white transition hover:bg-green-500"
        >
          <HouseIcon className="h-5 w-5" />
          Ta mig till startsidan
        </Link>
      </div>
    </main>
  );
}
