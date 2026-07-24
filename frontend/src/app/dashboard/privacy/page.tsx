"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldIcon, MailIcon, CalendarIcon, InfoIcon } from "@/components/icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { reopenCookieConsent } from "@/lib/consent";

interface SummaryData {
  totalAnalyses: number;
  memberSince: string;
}

export default function PrivacyPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/profile/summary");
        if (res.ok) {
          const data = await res.json();
          setSummary({
            totalAnalyses: data.totalAnalyses ?? 0,
            memberSince: data.memberSince ?? null,
          });
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const displayName = (user?.user_metadata?.full_name as string | undefined) || null;
  const email = user?.email ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="dash-enter">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-white">
          <ShieldIcon className="h-6 w-6 text-neutral-300" />
          Sekretess
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-neutral-400">
          En sammanfattning av vilka uppgifter Köpanalys har om dig och hur de
          används. Se vår fullständiga{" "}
          <a
            href="/privacy"
            className="text-green-400 underline underline-offset-4 transition hover:text-green-300"
          >
            integritetspolicy
          </a>{" "}
          för mer detaljer.
        </p>
      </div>

      <div className="dash-enter rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-neutral-300">
            <InfoIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-white">Dina kontouppgifter</h2>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm">
          {displayName && (
            <div className="flex items-center gap-2 text-neutral-300">
              <span className="text-neutral-500">Namn:</span>
              <span className="text-white">{displayName}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2 text-neutral-300">
              <MailIcon className="h-3.5 w-3.5 text-neutral-500" />
              <span className="text-white">{email}</span>
            </div>
          )}
          {summary?.memberSince && (
            <div className="flex items-center gap-2 text-neutral-300">
              <CalendarIcon className="h-3.5 w-3.5 text-neutral-500" />
              <span>
                Konto skapat:{" "}
                <span className="text-white">
                  {new Date(summary.memberSince).toLocaleDateString("sv-SE")}
                </span>
              </span>
            </div>
          )}
          <p className="mt-1 text-neutral-400">
            Dessa uppgifter lagras för att kunna tillhandahålla tjänsten och
            för att du ska kunna logga in och se din historik.
          </p>
        </div>
      </div>

      <div className="dash-enter rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-neutral-300">
            <ShieldIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-white">Dina analyser</h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          När du begär en analys av en bostad kopplas den begäran till ditt
          konto så att du kan se din historik på{" "}
          <Link href="/dashboard" className="text-green-400 underline underline-offset-4 transition hover:text-green-300">
            Mina analyser
          </Link>
          . Själva analysdata (bedömningar, poäng, marknadsdata) delas och cachas
          mellan användare — den är inte personlig för dig. Det innebär att andra
          användare som analyserar samma bostad kan se samma underliggande data,
          men inte att just du har begärt analysen.
        </p>
        {summary && (
          <p className="mt-3 text-sm text-neutral-400">
            Du har gjort <span className="text-white">{summary.totalAnalyses}</span>{" "}
            analys{summary.totalAnalyses !== 1 ? "er" : ""} hittills.
          </p>
        )}
      </div>

      <div className="dash-enter rounded-2xl border border-green-500/20 bg-green-500/[0.04] p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
            <ShieldIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-green-300">Vad vi INTE gör</h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-neutral-300">
          Köpanalys säljer inte dina uppgifter till tredje part. Din
          analyshistorik, din e-postadress och övrig kontoinformation används
          endast för att driva tjänsten och, om du samtyckt, för vår egen
          marknadsföring och produktförbättring. Vi delar eller säljer aldrig
          dina personuppgifter till externa köpare.
        </p>
      </div>

      <div className="dash-enter rounded-2xl border border-white/10 bg-[#0F1417]/85 p-5 backdrop-blur-xl">
        <h2 className="text-sm font-semibold text-white">Cookie-inställningar</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          Du kan när som helst återkalla eller ändra ditt samtycke för
          marknadsförings- och analyscookies.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={reopenCookieConsent}
            className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Ändra cookie-inställningar
          </button>
        </div>
      </div>
    </div>
  );
}
