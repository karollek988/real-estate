"use client";

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/icons";
import { FOCUS_URL_INPUT_EVENT } from "@/lib/onboardingModalEvents";

const STEPS = [
  {
    emoji: "👤",
    title: "Skapa ett gratis konto",
    description: "Registrera dig på några sekunder för att få tillgång till dina analyser.",
  },
  {
    emoji: "🏠",
    title: "Hitta en bostad på Hemnet",
    description: "Kopiera länken till den bostad du vill analysera.",
  },
  {
    emoji: "🔗",
    title: "Klistra in länken",
    description: "Klistra in Hemnet-länken och välj vilken typ av analys du vill genomföra.",
  },
  {
    emoji: "📊",
    title: "Få ett komplett beslutsunderlag",
    description:
      "Vi analyserar bostaden med hjälp av flera datakällor och AI och sammanställer ett lättläst beslutsunderlag.",
  },
];

export function OnboardingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Så fungerar det">
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
            aria-label="Stäng"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>

          <div className="px-6 pb-7 pt-8 lg:px-8">
            <h2 className="text-xl font-semibold tracking-tight text-white">Så fungerar det</h2>
            <p className="mt-1.5 text-sm text-neutral-400">Fyra steg från länk till färdigt beslutsunderlag.</p>

            <ol className="mt-6 flex flex-col gap-4">
              {STEPS.map(({ emoji, title, description }, i) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl">
                    {emoji}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[15px] font-semibold text-white">
                      <span className="mr-1.5 text-green-400">{i + 1}.</span>
                      {title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-400">{description}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-7 flex items-center gap-2 text-sm text-neutral-400">
              <span className="text-green-400">✓</span>
              Tar vanligtvis mindre än 60 sekunder
            </div>

            <button
              ref={ctaRef}
              type="button"
              onClick={handleCta}
              className="mt-5 w-full rounded-xl bg-green-600 py-3.5 text-[15px] font-semibold text-white transition hover:bg-green-500 focus:outline-none focus:ring-4 focus:ring-green-500/20"
            >
              Jag vill testa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
