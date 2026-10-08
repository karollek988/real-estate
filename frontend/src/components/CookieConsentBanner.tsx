"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getCookieConsent, setCookieConsent, REOPEN_CONSENT_EVENT } from "@/lib/consent";
import { CookieSettingsDialog } from "./CookieSettingsDialog";

export function CookieConsentBanner() {
  const t = useTranslations("consent");
  const [visible, setVisible] = useState(false);
  // "Anpassa val": the dialog with a switch for each cookie. While it is open the banner is not shown.
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    const existing = getCookieConsent();
    if (existing === null) {
      setVisible(true);
    }

    function onReopen() {
      setCustomizing(false);
      setVisible(true);
    }
    window.addEventListener(REOPEN_CONSENT_EVENT, onReopen);
    return () => window.removeEventListener(REOPEN_CONSENT_EVENT, onReopen);
  }, []);

  function decide(marketing: boolean) {
    setCookieConsent(marketing);
    setCustomizing(false);
    setVisible(false);
  }

  if (!visible) return null;

  if (customizing) {
    return <CookieSettingsDialog onSave={({ marketing }) => decide(marketing)} onBack={() => setCustomizing(false)} />;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90] p-4 sm:p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-ka-line-strong bg-ka-paper p-5 shadow-ka-card-hover backdrop-blur-xl sm:p-6 sm:shadow-ka-card-hover">
        <p className="text-sm leading-relaxed text-ka-text">
          {t.rich("text", {
            link: (chunks) => (
              <Link
                href="/privacy"
                className="font-medium text-ka-green-700 underline underline-offset-4 transition hover:text-ka-green-800"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => decide(false)}
            className="cursor-pointer rounded-xl border border-ka-line-strong bg-ka-cream px-5 py-2.5 text-sm font-semibold text-ka-text transition hover:border-ka-green-700/40 hover:bg-ka-sand"
          >
            {t("necessaryOnly")}
          </button>
          <button
            type="button"
            onClick={() => setCustomizing(true)}
            className="cursor-pointer rounded-xl border border-ka-line-strong bg-ka-cream px-5 py-2.5 text-sm font-semibold text-ka-text transition hover:border-ka-green-700/40 hover:bg-ka-sand"
          >
            {t("customize")}
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="cursor-pointer rounded-xl bg-ka-green-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ka-green-800"
          >
            {t("acceptAll")}
          </button>
        </div>
      </div>
    </div>
  );
}
