"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { ChevronDownIcon, ChevronRightIcon, CloseIcon, FilePlusIcon, GlobeIcon, LogOutIcon, UserIcon } from "@/components/icons";
import { LanguageLinks } from "@/components/LanguageSwitcher";
import { MAIN_NAV, ROUTES, hrefKey, isActivePath, isEntryActive } from "@/components/site/navigation";
import { MapSearchForm } from "./HeaderSearch";
import { ACCOUNT_LINKS, initialsFor } from "./UserMenu";
import type { HeaderTheme } from "./theme";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The menu below xl: a full-screen dialog with the map search, every
 * navigation entry (the two menus become expandable groups, the one holding
 * the current page starts open), "Skapa analys" and the account links. Mount
 * it only while open - focus moves in on mount and back to the menu button
 * (`returnFocusRef`) on unmount; Escape closes, Tab stays inside, and the page
 * behind does not scroll.
 */
export function MobileNav({
  theme,
  pathname,
  signedIn,
  displayName,
  returnFocusRef,
  onClose,
  onSignIn,
  onSignOut,
}: {
  theme: HeaderTheme;
  pathname: string;
  signedIn: boolean;
  displayName: string;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const t = useTranslations("nav");
  const tLanguage = useTranslations("common.languageSwitcher");
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [expanded, setExpanded] = useState<string | null>(
    () => MAIN_NAV.find((entry) => entry.kind === "menu" && isEntryActive(pathname, entry))?.id ?? null,
  );

  // Read through a ref so the effect below runs only on mount and unmount.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnTo = returnFocusRef.current;
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
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
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnTo?.focus();
    };
  }, [returnFocusRef]);

  const row = `flex min-h-14 w-full items-center gap-3.5 border-b py-3 text-left text-[17px] font-medium transition ${theme.drawerRow} ${theme.focusRing}`;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`animate-drawer-in fixed inset-0 z-[70] flex flex-col xl:hidden ${theme.drawer}`}
    >
      <h2 id={titleId} className="sr-only">
        {t("menuTitle")}
      </h2>
      <div className={`flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6 ${theme.drawerRow}`}>
        <Link href={ROUTES.home} onClick={onClose} aria-label={t("homeLabel")} className={`rounded-lg ${theme.focusRing}`}>
          <BrandLogo className={`text-[19px] ${theme.logo}`} markClassName="h-10 w-10" markSizes="40px" />
        </Link>
        <button
          type="button"
          data-autofocus
          onClick={onClose}
          aria-label={t("closeMenu")}
          className={`-mr-1.5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition ${theme.iconButton} ${theme.focusRing}`}
        >
          <CloseIcon className="h-6 w-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-10 pt-5 sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          <MapSearchForm theme={theme} idPrefix="mobile-nav-search" onSubmitted={onClose} />

          <nav aria-label={t("mainMenu")} className="mt-6">
            <ul className={`border-t ${theme.drawerRow}`}>
              {MAIN_NAV.map((entry) => {
                if (entry.kind === "link") {
                  const current = isActivePath(pathname, entry.href);
                  return (
                    <li key={entry.id}>
                      <Link
                        href={entry.href}
                        onClick={onClose}
                        aria-current={current ? "page" : undefined}
                        className={`${row} ${current ? theme.drawerActive : ""}`}
                      >
                        {entry.icon ? (
                          <entry.icon className={`h-[22px] w-[22px] shrink-0 ${theme.navIcon}`} />
                        ) : (
                          <span aria-hidden className="w-[22px] shrink-0" />
                        )}
                        <span className="flex-1">{t(`entries.${entry.id}`)}</span>
                        <ChevronRightIcon className={`h-5 w-5 shrink-0 ${theme.panelText}`} />
                      </Link>
                    </li>
                  );
                }

                const isOpen = expanded === entry.id;
                const groupId = `${titleId}-${entry.id}`;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={groupId}
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                      className={`${row} cursor-pointer ${isEntryActive(pathname, entry) ? "font-semibold" : ""}`}
                    >
                      <entry.icon className={`h-[22px] w-[22px] shrink-0 ${theme.navIcon}`} />
                      <span className="flex-1">{t(`entries.${entry.id}`)}</span>
                      <ChevronDownIcon
                        className={`h-5 w-5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""} ${theme.panelText}`}
                      />
                    </button>
                    <ul id={groupId} hidden={!isOpen} className={`border-b py-2 ${theme.drawerRow}`}>
                      {entry.items.map((item) => {
                        const current = isActivePath(pathname, item.href);
                        return (
                          <li key={hrefKey(item.href)}>
                            <Link
                              href={item.href}
                              onClick={onClose}
                              aria-current={current ? "page" : undefined}
                              className={`flex items-center gap-3.5 rounded-xl px-3 py-3 transition ${theme.panelItem} ${theme.focusRing} ${
                                current ? theme.panelItemActive : ""
                              }`}
                            >
                              <item.icon className={`h-6 w-6 shrink-0 ${theme.panelIcon}`} strokeWidth={1.5} />
                              <span className="min-w-0 flex-1">
                                <span className={`block text-[15.5px] font-semibold ${theme.panelTitle}`}>{t(`${item.key}.label`)}</span>
                                <span className={`mt-0.5 block text-[13.5px] ${theme.panelText}`}>{t(`${item.key}.description`)}</span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={ROUTES.skapaAnalys}
              onClick={onClose}
              className={`flex h-14 items-center justify-center gap-2.5 rounded-xl text-[16px] font-semibold transition ${theme.cta} ${theme.focusRing}`}
            >
              <FilePlusIcon className="h-[22px] w-[22px]" />
              {t("createAnalysis")}
            </Link>

            {signedIn ? (
              <div className={`mt-3 rounded-2xl border p-2 ${theme.drawerSecondary}`}>
                <p className="flex items-center gap-3 px-2 py-2 text-[14px]">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[13px] font-bold ${theme.avatar}`}>
                    {initialsFor(displayName) || <UserIcon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 truncate font-semibold">{displayName}</span>
                </p>
                <ul className={`border-t pt-1 ${theme.panelDivider}`}>
                  {ACCOUNT_LINKS.map(({ key, href }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onClose}
                        className={`block rounded-lg px-2 py-3 text-[15px] transition ${theme.panelItem} ${theme.focusRing}`}
                      >
                        {t(`account.links.${key}`)}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSignOut();
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-3 text-left text-[15px] transition ${theme.danger}`}
                    >
                      <LogOutIcon className="h-4 w-4" />
                      {t("account.signOut")}
                    </button>
                  </li>
                </ul>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSignIn();
                }}
                className={`flex h-14 cursor-pointer items-center justify-center gap-2.5 rounded-xl border text-[16px] font-semibold transition ${theme.drawerSecondary} ${theme.focusRing}`}
              >
                <UserIcon className="h-5 w-5" />
                {t("account.signIn")}
              </button>
            )}

            <div className={`mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-5 ${theme.drawerRow}`}>
              <span className={`flex items-center gap-2 text-[14px] ${theme.panelText}`}>
                <GlobeIcon className={`h-5 w-5 ${theme.navIcon}`} />
                {tLanguage("label")}
              </span>
              <LanguageLinks
                onChosen={onClose}
                itemClassName={`rounded-lg px-1 py-2 text-[15.5px] underline-offset-4 hover:underline ${theme.focusRing}`}
                currentClassName={`py-2 text-[15.5px] font-semibold ${theme.drawerActive}`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
