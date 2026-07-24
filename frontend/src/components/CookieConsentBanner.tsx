"use client";

import { useEffect, useState } from "react";
import { getCookieConsent, setCookieConsent, REOPEN_CONSENT_EVENT } from "@/lib/consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getCookieConsent();
    if (existing === null) {
      setVisible(true);
    }

    function onReopen() {
      setVisible(true);
    }
    window.addEventListener(REOPEN_CONSENT_EVENT, onReopen);
    return () => window.removeEventListener(REOPEN_CONSENT_EVENT, onReopen);
  }, []);

  function acceptAll() {
    setCookieConsent(true);
    setVisible(false);
  }

  function declineAll() {
    setCookieConsent(false);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90] p-4 sm:p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#0A0F0D] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6 sm:shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
        <p className="text-sm leading-relaxed text-neutral-300">
          Vi använder nödvändiga cookies för att webbplatsen ska fungera. Vill du även
          godkänna cookies för marknadsföring och analys? Läs mer i vår{" "}
          <a
            href="/privacy"
            className="font-medium text-green-400 underline underline-offset-4 transition hover:text-green-300"
          >
            integritetspolicyn
          </a>
          .
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={declineAll}
            className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/10"
          >
            Neka alla
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="cursor-pointer rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500"
          >
            Acceptera alla
          </button>
        </div>
      </div>
    </div>
  );
}
