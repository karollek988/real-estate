"use client";

import { useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, SearchIcon } from "@/components/icons";
import { ROUTES } from "@/components/site/navigation";
import { POPOVER_CLOSED, POPOVER_OPEN, type HeaderTheme } from "./theme";
import { useDismiss } from "./useDismiss";

/** Where a search goes: the map, which looks the query up among its listings and then as a place in Sweden. */
export function mapSearchHref(query: string) {
  const q = query.trim();
  return q ? `${ROUTES.karta}?q=${encodeURIComponent(q)}` : ROUTES.karta;
}

/** The search form, shared by the header's search panel and the mobile menu. */
export function MapSearchForm({
  theme,
  onSubmitted,
  inputRef,
  idPrefix,
}: {
  theme: HeaderTheme;
  onSubmitted?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  idPrefix: string;
}) {
  const router = useRouter();
  const inputId = `${idPrefix}-input`;
  const hintId = `${idPrefix}-hint`;

  return (
    <form
      role="search"
      aria-label="Sök på kartan"
      onSubmit={(e) => {
        e.preventDefault();
        const value = new FormData(e.currentTarget).get("q");
        router.push(mapSearchHref(typeof value === "string" ? value : ""));
        onSubmitted?.();
      }}
    >
      <label htmlFor={inputId} className={`text-[13px] font-semibold ${theme.panelTitle}`}>
        Sök adress, område eller ort
      </label>
      <div className="mt-2 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className={`pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 ${theme.panelText}`} />
          <input
            ref={inputRef}
            id={inputId}
            name="q"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="T.ex. Södermalm eller Storgatan 12, Eslöv"
            aria-describedby={hintId}
            className={`h-12 w-full rounded-xl border pl-10 pr-3 text-[15px] outline-none transition focus:ring-4 focus:ring-ka-green-700/10 ${theme.input}`}
          />
        </div>
        <button
          type="submit"
          aria-label="Sök"
          className={`flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl transition ${theme.cta} ${theme.focusRing}`}
        >
          <ArrowRightIcon className="h-5 w-5" />
        </button>
      </div>
      <p id={hintId} className={`mt-2 text-[12.5px] leading-snug ${theme.panelText}`}>
        Vi visar platsen och bostäderna runt den på kartan.
      </p>
    </form>
  );
}

/** The header's search button and the small panel it opens. */
export function HeaderSearch({
  theme,
  open,
  onOpenChange,
}: {
  theme: HeaderTheme;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useDismiss(open, rootRef, (reason) => {
    onOpenChange(false);
    if (reason === "escape") buttonRef.current?.focus();
  });

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Sök"
        title="Sök"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          onOpenChange(!open);
          if (!open) requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition ${theme.iconButton} ${theme.focusRing}`}
      >
        <SearchIcon className="h-[22px] w-[22px]" strokeWidth={2} />
      </button>
      <div
        id={panelId}
        className={`absolute -right-[60px] top-[calc(100%+14px)] z-10 w-[min(400px,calc(100vw-32px))] rounded-2xl border p-4 sm:right-0 ${theme.panel} ${
          open ? POPOVER_OPEN : POPOVER_CLOSED
        }`}
      >
        <MapSearchForm theme={theme} inputRef={inputRef} idPrefix={`${panelId}-search`} onSubmitted={() => onOpenChange(false)} />
      </div>
    </div>
  );
}
