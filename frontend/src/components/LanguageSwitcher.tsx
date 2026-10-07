"use client";

import { useId, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getPathname, usePathname, type Href } from "@/i18n/navigation";
import { CheckIcon, GlobeIcon } from "@/components/icons";
import { POPOVER_CLOSED, POPOVER_OPEN, type HeaderTheme } from "@/components/header/theme";
import { useDismiss } from "@/components/header/useDismiss";
import { LOCALES, LOCALE_CODES, LOCALE_COOKIE, LOCALE_COOKIE_DAYS, type AppLocale } from "@/i18n/locales";

/**
 * Remembers the visitor's own choice, so that the site opens in their language next time (proxy.ts reads it).
 * Called only when a visitor actively picks a language here - never on its own. It is a functional cookie
 * (it stores what was asked for and nothing else), described in the privacy policy.
 */
function rememberLanguage(code: AppLocale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${code}; Max-Age=${LOCALE_COOKIE_DAYS * 24 * 60 * 60}; Path=/; SameSite=Lax${secure}`;
}

/**
 * What a language link needs: where it points (this same page - its internal address with its [slug] - in
 * that language, written out as the address a visitor sees: Swedish without a prefix, English under /en),
 * and what to do when it is clicked. The ?query is read only at the click: reading it while rendering
 * would make every page that shows the header wait for the browser (Next's "useSearchParams" rule).
 */
function useSwitchLanguage() {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  // the [slug]s of the page's address, with the values this page has (a 404 inside /blogg/[slug] has none)
  const wanted = [...pathname.matchAll(/\[(\w+)\]/g)].map((match) => match[1]);
  const own = Object.fromEntries(wanted.map((name) => [name, (params ?? {})[name]]));

  const addressIn = (code: AppLocale, query?: Record<string, string | string[]>) => {
    // The picker must never break a page: where this page's address cannot be written in the other
    // language (an unknown address, a missing [slug]), it leads to the other language's start page.
    try {
      if (!Object.values(own).every((value) => typeof value === "string")) throw new Error("missing parameter");
      const href = { pathname, ...(wanted.length > 0 ? { params: own } : {}), ...(query ? { query } : {}) };
      return getPathname({ locale: code, href: href as unknown as Href });
    } catch {
      return getPathname({ locale: code, href: "/" });
    }
  };

  function onChoose(code: AppLocale, event: React.MouseEvent<HTMLAnchorElement>) {
    rememberLanguage(code);
    const search = window.location.search;
    // a plain click on a page that has a ?query: go there ourselves, so the query comes along
    if (!search || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const query: Record<string, string | string[]> = {};
    for (const [name, value] of new URLSearchParams(search)) {
      const before = query[name];
      query[name] = before === undefined ? value : Array.isArray(before) ? [...before, value] : [before, value];
    }
    router.push(addressIn(code, query));
  }

  return { addressIn, onChoose };
}

/** One language in the list: a link to this page in that language, or - for the current one - plain text. */
function LanguageItem({ code, current, className, currentClassName, onChosen }: { code: AppLocale; current: boolean; className: string; currentClassName: string; onChosen?: () => void }) {
  const t = useTranslations("common.languageSwitcher");
  const { addressIn, onChoose } = useSwitchLanguage();
  const language = LOCALES[code];
  if (current) {
    return (
      <span aria-current="true" lang={language.htmlLang} className={currentClassName}>
        {language.name}
        <CheckIcon className="h-4 w-4 shrink-0" aria-hidden />
      </span>
    );
  }
  return (
    <NextLink
      href={addressIn(code)}
      prefetch={false}
      lang={language.htmlLang}
      hrefLang={language.htmlLang}
      aria-label={t("switchTo", { language: language.name })}
      onClick={(event) => {
        onChoose(code, event);
        onChosen?.();
      }}
      className={className}
    >
      {language.name}
    </NextLink>
  );
}

/**
 * The language picker in the page header: a button (a globe and the language's code) that opens a short list,
 * themed like the header's other menus. Open or closed is decided by the header, so only one menu is open at a time.
 */
export function LanguageMenu({ theme, open, onOpenChange }: { theme: HeaderTheme; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("common.languageSwitcher");
  const current = useLocale() as AppLocale;
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useDismiss(open, rootRef, (reason) => {
    onOpenChange(false);
    if (reason === "escape") buttonRef.current?.focus();
  });

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("current", { language: LOCALES[current].name })}
        title={t("label")}
        className={`flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[13.5px] font-semibold uppercase tracking-[0.04em] transition ${theme.iconButton} ${theme.focusRing}`}
      >
        <GlobeIcon className="h-[22px] w-[22px]" />
        <span aria-hidden>{LOCALES[current].htmlLang}</span>
      </button>
      <div
        id={panelId}
        className={`absolute right-0 top-[calc(100%+14px)] z-10 w-48 overflow-hidden rounded-2xl border p-1.5 ${theme.panel} ${open ? POPOVER_OPEN : POPOVER_CLOSED}`}
      >
        <ul>
          {LOCALE_CODES.map((code) => (
            <li key={code}>
              <LanguageItem
                code={code}
                current={code === current}
                onChosen={() => onOpenChange(false)}
                className={`block rounded-lg px-3 py-2.5 text-[14.5px] outline-none transition ${theme.panelTitle} ${theme.panelItem}`}
                currentClassName={`flex items-center justify-between rounded-lg px-3 py-2.5 text-[14.5px] font-semibold ${theme.panelIcon}`}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The same choice as a plain row of links, for the phone menu and the footer. `itemClassName` styles a
 * language that can be chosen; `currentClassName` the one that is shown now.
 */
export function LanguageLinks({ className = "", itemClassName = "", currentClassName = "font-semibold", onChosen }: { className?: string; itemClassName?: string; currentClassName?: string; onChosen?: () => void }) {
  const t = useTranslations("common.languageSwitcher");
  const current = useLocale() as AppLocale;
  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {LOCALE_CODES.map((code) => (
          <li key={code}>
            <LanguageItem code={code} current={code === current} onChosen={onChosen} className={itemClassName} currentClassName={`inline-flex items-center gap-1.5 ${currentClassName}`} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
