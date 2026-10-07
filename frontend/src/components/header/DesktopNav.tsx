"use client";

import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/icons";
import { MAIN_NAV, hrefKey, isActivePath, isEntryActive, type NavEntry } from "@/components/site/navigation";
import { POPOVER_CLOSED, POPOVER_OPEN, type HeaderTheme } from "./theme";
import { useDismiss } from "./useDismiss";

const ITEM_BASE =
  "relative inline-flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] px-2.5 text-[15px] font-medium transition-colors duration-200 min-[1400px]:px-3";

// The icons need the room of a wide screen; between xl and 1400px the labels stand alone.
const NAV_ICON = "hidden h-[21px] w-[21px] shrink-0 min-[1400px]:block";

// Mouse users get a short grace period to travel from the button into the panel.
const HOVER_CLOSE_DELAY_MS = 160;

/**
 * The header's main navigation from xl up: plain links plus the two menus
 * (Bostadsanalys, Kunskap). A menu is a disclosure - a button with
 * aria-expanded that shows a list of real links - opened by hovering with a
 * mouse, by click or tap, or from the keyboard (Enter, Space, ArrowDown).
 * Escape closes it and returns focus to its button; arrow keys move between
 * its links. Only one menu is open at a time (the parent owns `openMenu`).
 */
export function DesktopNav({
  pathname,
  theme,
  openMenu,
  onOpenMenuChange,
  className = "",
}: {
  pathname: string;
  theme: HeaderTheme;
  openMenu: string | null;
  onOpenMenuChange: (id: string | null) => void;
  className?: string;
}) {
  const t = useTranslations("nav");
  return (
    <nav aria-label={t("mainMenu")} className={`h-full items-center gap-0.5 ${className}`}>
      {MAIN_NAV.map((entry) =>
        entry.kind === "menu" ? (
          <NavMenu
            key={entry.id}
            entry={entry}
            pathname={pathname}
            theme={theme}
            open={openMenu === entry.id}
            onOpenChange={(open) => onOpenMenuChange(open ? entry.id : null)}
          />
        ) : (
          <Link
            key={entry.id}
            href={entry.href}
            aria-current={isActivePath(pathname, entry.href) ? "page" : undefined}
            className={`${ITEM_BASE} ${theme.focusRing} ${isEntryActive(pathname, entry) ? theme.navActive : theme.nav}`}
          >
            {entry.icon && <entry.icon className={`${NAV_ICON} ${theme.navIcon}`} />}
            {t(`entries.${entry.id}`)}
          </Link>
        ),
      )}
    </nav>
  );
}

function NavMenu({
  entry,
  pathname,
  theme,
  open,
  onOpenChange,
}: {
  entry: Extract<NavEntry, { kind: "menu" }>;
  pathname: string;
  theme: HeaderTheme;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("nav");
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointer = useRef<string>("mouse");
  const active = isEntryActive(pathname, entry);

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  useDismiss(open, rootRef, (reason) => {
    cancelClose();
    onOpenChange(false);
    if (reason === "escape") buttonRef.current?.focus();
  });

  function links() {
    return Array.from(rootRef.current?.querySelectorAll<HTMLAnchorElement>("[data-menu-link]") ?? []);
  }

  function focusLink(index: number) {
    const all = links();
    all[(index + all.length) % all.length]?.focus();
  }

  return (
    <div
      ref={rootRef}
      className="relative flex h-full items-center"
      onPointerDown={(e) => {
        lastPointer.current = e.pointerType;
      }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        cancelClose();
        onOpenChange(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        cancelClose();
        closeTimer.current = setTimeout(() => onOpenChange(false), HOVER_CLOSE_DELAY_MS);
      }}
      onBlur={(e) => {
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) onOpenChange(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          // A mouse already opened the menu by hovering; a click on top of that
          // must not close it again under the pointer. (Keyboard clicks have
          // detail 0 and always toggle.)
          if (open && e.detail > 0 && lastPointer.current === "mouse") return;
          onOpenChange(!open);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onOpenChange(true);
            requestAnimationFrame(() => focusLink(0));
          }
        }}
        className={`${ITEM_BASE} ${theme.focusRing} ${open ? theme.navOpen : active ? theme.navActive : theme.nav}`}
      >
        <entry.icon className={`${NAV_ICON} ${theme.navIcon}`} />
        {t(`entries.${entry.id}`)}
        <ChevronDownIcon
          className={`-ml-0.5 h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.2}
        />
      </button>

      <div
        id={panelId}
        className={`absolute left-0 top-[calc(100%-10px)] z-10 w-[360px] origin-top-left rounded-2xl border p-2 ${theme.panel} ${
          open ? POPOVER_OPEN : POPOVER_CLOSED
        }`}
        onKeyDown={(e) => {
          const all = links();
          const index = all.indexOf(document.activeElement as HTMLAnchorElement);
          if (e.key === "ArrowDown") {
            e.preventDefault();
            focusLink(index + 1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            focusLink(index - 1);
          } else if (e.key === "Home") {
            e.preventDefault();
            focusLink(0);
          } else if (e.key === "End") {
            e.preventDefault();
            focusLink(all.length - 1);
          }
        }}
      >
        <ul>
          {entry.items.map((item, i) => {
            const current = isActivePath(pathname, item.href);
            return (
              <li key={hrefKey(item.href)} className={i > 0 ? `border-t ${theme.panelDivider}` : undefined}>
                <Link
                  href={item.href}
                  data-menu-link
                  aria-current={current ? "page" : undefined}
                  onClick={() => onOpenChange(false)}
                  className={`group flex items-center gap-4 rounded-xl px-4 py-3.5 outline-none transition-colors ${theme.panelItem} ${
                    current ? theme.panelItemActive : ""
                  }`}
                >
                  <item.icon className={`h-7 w-7 shrink-0 ${theme.panelIcon}`} strokeWidth={1.5} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[15.5px] font-semibold leading-tight ${theme.panelTitle}`}>{t(`${item.key}.label`)}</span>
                    <span className={`mt-1 block text-[13.5px] leading-snug ${theme.panelText}`}>{t(`${item.key}.description`)}</span>
                  </span>
                  <ChevronRightIcon
                    className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${theme.panelText}`}
                    strokeWidth={2}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
