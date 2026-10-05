"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import { LogOutIcon, UserIcon } from "@/components/icons";
import { POPOVER_CLOSED, POPOVER_OPEN, type HeaderTheme } from "./theme";
import { useDismiss } from "./useDismiss";

export const ACCOUNT_LINKS = [
  { label: "Mina analyser", href: "/dashboard" },
  { label: "Visningsguide", href: "/dashboard/inspection" },
  { label: "Köp & saldo", href: "/dashboard/subscriptions" },
  { label: "Inställningar", href: "/dashboard/settings" },
  { label: "Sekretess", href: "/dashboard/privacy" },
];

export function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * The header's profile button. Signed out it opens the sign-in dialog; signed
 * in it shows the user's initials and a menu with the account pages.
 */
export function UserMenu({
  theme,
  displayName,
  signedIn,
  open,
  onOpenChange,
  onSignIn,
  onSignOut,
}: {
  theme: HeaderTheme;
  displayName: string;
  signedIn: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useDismiss(open, rootRef, (reason) => {
    onOpenChange(false);
    if (reason === "escape") buttonRef.current?.focus();
  });

  const circle = `flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border transition 2xl:h-12 2xl:w-12 ${theme.avatar} ${theme.focusRing}`;

  if (!signedIn) {
    return (
      <button type="button" onClick={onSignIn} aria-label="Logga in" title="Logga in" className={circle}>
        <UserIcon className="h-[22px] w-[22px]" strokeWidth={1.8} />
      </button>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={`Konto: ${displayName}`}
        aria-expanded={open}
        aria-controls={panelId}
        className={`${circle} text-[15px] font-bold`}
      >
        {initialsFor(displayName) || <UserIcon className="h-[22px] w-[22px]" strokeWidth={1.8} />}
      </button>
      <div
        id={panelId}
        className={`absolute right-0 top-[calc(100%+14px)] z-10 w-60 overflow-hidden rounded-2xl border p-1.5 ${theme.panel} ${
          open ? POPOVER_OPEN : POPOVER_CLOSED
        }`}
      >
        <p className={`truncate px-3 pb-2 pt-2.5 text-[13px] ${theme.panelText}`}>
          Inloggad som <span className={`font-semibold ${theme.panelTitle}`}>{displayName}</span>
        </p>
        <ul className={`border-t pt-1.5 ${theme.panelDivider}`}>
          {ACCOUNT_LINKS.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => onOpenChange(false)}
                className={`block rounded-lg px-3 py-2.5 text-[14.5px] outline-none transition ${theme.panelTitle} ${theme.panelItem}`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className={`mt-1.5 border-t pt-1.5 ${theme.panelDivider}`}>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onSignOut();
            }}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14.5px] outline-none transition ${theme.danger}`}
          >
            <LogOutIcon className="h-4 w-4" />
            Logga ut
          </button>
        </div>
      </div>
    </div>
  );
}
