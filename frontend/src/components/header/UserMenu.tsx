"use client";

import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LogOutIcon, UserIcon } from "@/components/icons";
import { POPOVER_CLOSED, POPOVER_OPEN, type HeaderTheme } from "./theme";
import { useDismiss } from "./useDismiss";

/** The account pages. The words are in the "nav" area under account.links.<key>. */
export const ACCOUNT_LINKS = [
  { key: "analyses", href: "/dashboard" },
  { key: "inspection", href: "/dashboard/inspection" },
  { key: "purchases", href: "/dashboard/subscriptions" },
  { key: "settings", href: "/dashboard/settings" },
  { key: "privacy", href: "/dashboard/privacy" },
] as const;

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
  const t = useTranslations("nav");
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
      <button type="button" onClick={onSignIn} aria-label={t("account.signIn")} title={t("account.signIn")} className={circle}>
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
        aria-label={t("account.accountOf", { name: displayName })}
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
          {t.rich("account.signedInAs", { name: displayName, b: (chunks) => <span className={`font-semibold ${theme.panelTitle}`}>{chunks}</span> })}
        </p>
        <ul className={`border-t pt-1.5 ${theme.panelDivider}`}>
          {ACCOUNT_LINKS.map(({ key, href }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => onOpenChange(false)}
                className={`block rounded-lg px-3 py-2.5 text-[14.5px] outline-none transition ${theme.panelTitle} ${theme.panelItem}`}
              >
                {t(`account.links.${key}`)}
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
            {t("account.signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}
