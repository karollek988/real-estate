"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { CloseIcon } from "@/components/icons";
import { FOCUS_URL_INPUT_EVENT } from "@/lib/onboardingModalEvents";

/** The four steps: a picture and the name of the step in the "onboarding" messages (steps.<id>.title / .description). */
const STEPS = [
  { id: "account", emoji: "👤" },
  { id: "upload", emoji: "📸" },
  { id: "check", emoji: "✓" },
  { id: "report", emoji: "📊" },
] as const;

export function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("onboarding");
  const dialogRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    ctaRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleCta() {
    onClose();
    window.dispatchEvent(new Event(FOCUS_URL_INPUT_EVENT));
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true" aria-label={t("title")}>
      <div
        className="fixed inset-0 animate-overlay-fade-in bg-black/70 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        className="relative flex min-h-full items-center justify-center p-4 lg:p-8"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={dialogRef}
          className="animate-modal-pop-in relative w-full max-w-[480px] overflow-hidden rounded-[24px] border border-white/10 bg-[#0F1417] shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>

          <div className="px-6 pb-7 pt-8 lg:px-8">
            <h2 className="text-xl font-semibold tracking-tight text-white">{t("title")}</h2>
            <p className="mt-1.5 text-sm text-neutral-400">{t("lead")}</p>

            <ol className="mt-6 flex flex-col gap-4">
              {STEPS.map(({ id, emoji }, i) => (
                <li key={id} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl">
                    {emoji}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[15px] font-semibold text-white">
                      <span className="mr-1.5 text-green-400">{i + 1}.</span>
                      {t(`steps.${id}.title`)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-400">{t(`steps.${id}.description`)}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-7 flex items-center gap-2 text-sm text-neutral-400">
              <span className="text-green-400">✓</span>
              {t("duration")}
            </div>

            <button
              ref={ctaRef}
              type="button"
              onClick={handleCta}
              className="mt-5 w-full rounded-xl bg-green-600 py-3.5 text-[15px] font-semibold text-white transition hover:bg-green-500 focus:outline-none focus:ring-4 focus:ring-green-500/20"
            >
              {t("cta")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
