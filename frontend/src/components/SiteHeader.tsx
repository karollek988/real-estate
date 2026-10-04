"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthModal } from "@/components/AuthModal";
import { BrandLogo } from "@/components/BrandLogo";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { CloseIcon, HouseDoorIcon, LogOutIcon, MenuIcon, SearchIcon, UserIcon } from "@/components/icons";
import { FOCUS_URL_INPUT_EVENT, OPEN_ONBOARDING_MODAL_EVENT } from "@/lib/onboardingModalEvents";

type NavAction = { type: "modal" } | { type: "link"; href: string };

/** The landing design's four destinations. "Blogg & Nyheter" lands on the market data and news block. */
const NAV_ITEMS: { label: string; action: NavAction }[] = [
  { label: "Bostadsanalys", action: { type: "link", href: "/" } },
  { label: "Så fungerar det", action: { type: "modal" } },
  { label: "Blogg & Nyheter", action: { type: "link", href: "/#nyheter" } },
  { label: "Priser", action: { type: "link", href: "/#priser" } },
];

const SCROLL_SPY_IDS = ["nyheter", "priser"];

const BUY_ANALYSIS_HREF = "/buy";

/**
 * "light" is the redesigned header (cream, deep green). "dark" keeps the same
 * layout in the dark palette for the pages that have not been redesigned yet
 * (/buy, the dashboard), so the header never clashes with the page under it.
 */
export type SiteHeaderVariant = "light" | "dark";

const THEME = {
  light: {
    bar: "border-ka-line bg-ka-cream/95 text-ka-ink",
    barScrolled: "shadow-[0_12px_32px_-22px_rgba(15,31,24,0.45)]",
    logo: "text-ka-ink",
    mark: "text-ka-green-900",
    nav: "text-ka-text hover:text-ka-green-700",
    navActive: "font-semibold text-ka-green-700",
    underline: "bg-ka-green-700",
    iconButton: "text-ka-ink hover:bg-ka-ink/[0.06]",
    cta: "bg-ka-green-900 text-white hover:bg-ka-green-800 shadow-[0_8px_20px_-12px_rgba(12,42,31,0.8)]",
    avatar: "border-[#cfcabd] bg-[#ebe7de] text-ka-ink hover:border-ka-green-700/50",
    menuPanel: "border-ka-line bg-ka-cream",
    menuItem: "border-ka-line text-ka-text hover:text-ka-green-700",
    menuItemActive: "font-semibold text-ka-green-700",
    menuSecondary: "border-ka-line bg-white text-ka-ink hover:bg-ka-sand",
    dropdown: "border-ka-line bg-ka-paper shadow-[0_18px_40px_-20px_rgba(15,31,24,0.45)]",
    dropdownItem: "text-ka-text hover:bg-ka-sand hover:text-ka-ink",
    dropdownDivider: "border-ka-line",
    danger: "text-ka-red-600 hover:bg-ka-red-600/[0.07]",
  },
  dark: {
    bar: "border-white/10 bg-[#0A1212]/90 text-white",
    barScrolled: "shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)]",
    logo: "text-white",
    mark: "text-green-400",
    nav: "text-neutral-300 hover:text-white",
    navActive: "font-semibold text-white",
    underline: "bg-green-500",
    iconButton: "text-neutral-200 hover:bg-white/[0.06]",
    cta: "bg-green-600 text-white hover:bg-green-500",
    avatar: "border-green-500/30 bg-green-400/10 text-green-400 hover:border-green-500/50",
    menuPanel: "border-white/10 bg-[#0A1212]",
    menuItem: "border-white/5 text-neutral-300 hover:text-white",
    menuItemActive: "font-semibold text-white",
    menuSecondary: "border-white/10 bg-white/5 text-white hover:bg-white/10",
    dropdown: "border-white/10 bg-[#0F1417]",
    dropdownItem: "text-neutral-300 hover:bg-white/5 hover:text-white",
    dropdownDivider: "border-white/10",
    danger: "text-red-400 hover:bg-red-500/10",
  },
} as const;

type Theme = (typeof THEME)[SiteHeaderVariant];

function scrollToSection(id: string) {
  const target = document.getElementById(id);
  const visible = target && target.offsetParent !== null;
  const el = visible ? target : document.getElementById(`${id}-mobile`);
  el?.scrollIntoView({ behavior: "smooth" });
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function NavLink({
  label,
  action,
  active,
  isHome,
  theme,
  onOnboardingOpen,
  onNavigate,
  onScrollActivate,
  variant = "desktop",
}: {
  label: string;
  action: NavAction;
  active: boolean;
  isHome: boolean;
  theme: Theme;
  onOnboardingOpen: () => void;
  onNavigate?: () => void;
  onScrollActivate: (id: string | null) => void;
  variant?: "desktop" | "mobile";
}) {
  const className =
    variant === "desktop"
      ? `relative inline-flex h-full cursor-pointer items-center whitespace-nowrap text-[15px] transition-colors duration-200 xl:text-[16px] ${
          active ? theme.navActive : theme.nav
        }`
      : `cursor-pointer border-b py-3.5 text-left text-[16px] transition ${theme.menuItem} ${active ? theme.menuItemActive : ""}`;

  const underline =
    variant === "desktop" ? (
      <span
        aria-hidden
        className={`absolute inset-x-0 bottom-[14px] h-[3px] rounded-full transition-all duration-300 ${theme.underline} ${
          active ? "opacity-100" : "scale-x-50 opacity-0"
        }`}
      />
    ) : null;

  if (action.type === "link") {
    const isFragmentLink = action.href === "/" || action.href.startsWith("/#");
    return (
      <Link
        href={action.href}
        aria-current={active ? "page" : undefined}
        onClick={(e) => {
          if (isFragmentLink && isHome) {
            e.preventDefault();
            if (action.href === "/") {
              onScrollActivate(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
              const id = action.href.slice(2);
              onScrollActivate(id);
              scrollToSection(id);
            }
          }
          onNavigate?.();
        }}
        className={className}
      >
        {label}
        {underline}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onOnboardingOpen();
        onNavigate?.();
      }}
      className={className}
    >
      {label}
      {underline}
    </button>
  );
}

function UserDropdown({ label, theme }: { label: string; theme: Theme }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  const items: { label: string; href?: string; onClick?: () => void; danger?: boolean }[] = [
    { label: "Mina analyser", href: "/dashboard" },
    { label: "Inställningar", href: "/dashboard/settings" },
    { label: "Om mig", href: "/dashboard/settings" },
    { label: "Visningsguide", href: "/dashboard/inspection" },
    { label: "Sekretess", href: "/dashboard/privacy" },
    { label: "—" },
    { label: "Logga ut", onClick: handleSignOut, danger: true },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Användarmeny"
        aria-expanded={open}
        className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border text-[15px] font-bold transition xl:h-12 xl:w-12 xl:text-[16px] ${theme.avatar}`}
      >
        {initialsFor(label) || "?"}
      </button>
      {open && (
        <div className={`absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border backdrop-blur-xl ${theme.dropdown}`}>
          {items.map((item, i) =>
            item.label === "—" ? (
              <div key={i} className={`mx-3 border-t ${theme.dropdownDivider}`} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => {
                  close();
                  if (item.onClick) item.onClick();
                  else if (item.href) router.push(item.href);
                }}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition ${
                  item.danger ? theme.danger : theme.dropdownItem
                }`}
              >
                {item.danger && <LogOutIcon className="h-4 w-4" />}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ variant = "dark" }: { variant?: SiteHeaderVariant }) {
  const theme = THEME[variant];
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const { user, signOut } = useAuth();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "";
  const isHome = pathname === "/";

  const isItemActive = useCallback(
    (action: NavAction) => {
      if (action.type !== "link" || !isHome) return false;
      if (action.href === "/") return activeSection === null;
      return action.href.startsWith("/#") && activeSection === action.href.slice(2);
    },
    [activeSection, isHome]
  );

  // The search icon starts an analysis: on the landing page it scrolls to the
  // analysis card (the same event the onboarding modal's CTA uses), elsewhere
  // it navigates there.
  const openSearch = useCallback(() => {
    setMenuOpen(false);
    if (isHome) window.dispatchEvent(new Event(FOCUS_URL_INPUT_EVENT));
    else router.push("/#analyze");
  }, [isHome, router]);

  useEffect(() => {
    const onOpenOnboarding = () => setOnboardingOpen(true);
    window.addEventListener(OPEN_ONBOARDING_MODAL_EVENT, onOpenOnboarding);
    return () => window.removeEventListener(OPEN_ONBOARDING_MODAL_EVENT, onOpenOnboarding);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      // The IntersectionObserver below only fires on intersection *crossings*, so it
      // can't be trusted to catch every moment the user lands back near the top of
      // the page (the crossing that exits a tracked section may happen well above
      // scrollY 80, after which no further callback fires). Drive the "back to
      // Start" reset off actual scroll position instead, decoupled from the observer.
      if (window.scrollY < 80) setActiveSection(null);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const targets = SCROLL_SPY_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null && el.offsetParent !== null
    );
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        } else if (entries.every((entry) => !entry.isIntersecting)) {
          // Left a tracked section for one that isn't tracked: "Bostadsanalys" again.
          setActiveSection((current) => (entries.some((entry) => entry.target.id === current) ? null : current));
        }
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-shadow duration-300 ${theme.bar} ${
          scrolled ? theme.barScrolled : ""
        }`}
      >
        {variant === "light" && (
          // Faint topographic contours behind the right half, as in the design reference.
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-[52%] hidden w-[640px] bg-[url('/images/header-contours.svg')] bg-[length:640px_80px] bg-no-repeat opacity-60 lg:block"
          />
        )}
        <div className="relative mx-auto flex h-16 w-full max-w-[1680px] items-center justify-between px-5 sm:px-8 lg:h-[76px] xl:px-12 2xl:px-[84px]">
          <div className="flex h-full items-center gap-8 xl:gap-16">
            <Link
              href="/"
              aria-label="Köpanalys – till startsidan"
              className={`flex items-center transition-opacity hover:opacity-80 ${theme.logo}`}
            >
              <BrandLogo
                className="text-[21px] xl:text-[23px] 2xl:text-[26px]"
                markClassName={`h-8 w-auto xl:h-9 2xl:h-[44px] ${theme.mark}`}
              />
            </Link>
            <nav aria-label="Huvudmeny" className="hidden h-full items-center gap-6 lg:flex xl:gap-9 2xl:gap-11">
              {NAV_ITEMS.map(({ label, action }) => (
                <NavLink
                  key={label}
                  label={label}
                  action={action}
                  active={isItemActive(action)}
                  isHome={isHome}
                  theme={theme}
                  onOnboardingOpen={() => setOnboardingOpen(true)}
                  onScrollActivate={setActiveSection}
                />
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 xl:gap-6">
            <button
              type="button"
              onClick={openSearch}
              aria-label="Sök och analysera en bostad"
              title="Sök och analysera en bostad"
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition ${theme.iconButton}`}
            >
              <SearchIcon className="h-[22px] w-[22px] xl:h-[25px] xl:w-[25px]" strokeWidth={2.2} />
            </button>
            <Link
              href={BUY_ANALYSIS_HREF}
              className={`group hidden items-center gap-2.5 whitespace-nowrap rounded-[10px] px-4 py-3 text-[15px] font-semibold transition-all duration-200 hover:-translate-y-px sm:inline-flex xl:h-[49px] xl:px-[22px] xl:text-[16px] ${theme.cta}`}
            >
              <HouseDoorIcon className="h-[19px] w-[19px] transition-transform duration-200 group-hover:scale-110 xl:h-[22px] xl:w-[22px]" />
              Köp analys
            </Link>
            <div className="hidden lg:block">
              {user ? (
                <UserDropdown label={displayName} theme={theme} />
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  aria-label="Logga in"
                  title="Logga in"
                  className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border transition xl:h-12 xl:w-12 ${theme.avatar}`}
                >
                  <UserIcon className="h-5 w-5" strokeWidth={1.9} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Stäng meny" : "Öppna meny"}
              aria-expanded={menuOpen}
              className={`-mr-2 flex h-10 w-10 items-center justify-center rounded-lg transition lg:hidden ${theme.iconButton}`}
            >
              {menuOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-7 w-7" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            aria-label="Huvudmeny"
            className={`absolute inset-x-0 top-full flex flex-col border-b px-5 pb-6 pt-1 shadow-[0_24px_40px_-24px_rgba(15,31,24,0.35)] sm:px-8 lg:hidden ${theme.menuPanel}`}
          >
            {NAV_ITEMS.map(({ label, action }) => (
              <NavLink
                key={label}
                label={label}
                action={action}
                active={isItemActive(action)}
                isHome={isHome}
                theme={theme}
                onOnboardingOpen={() => setOnboardingOpen(true)}
                onNavigate={() => setMenuOpen(false)}
                onScrollActivate={setActiveSection}
                variant="mobile"
              />
            ))}
            <Link
              href={BUY_ANALYSIS_HREF}
              onClick={() => setMenuOpen(false)}
              className={`mt-5 flex items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-center text-[15px] font-semibold transition ${theme.cta}`}
            >
              <HouseDoorIcon className="h-[18px] w-[18px]" />
              Köp analys
            </Link>
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className={`mt-3 flex items-center gap-3 rounded-[10px] border px-4 py-3 text-sm font-semibold ${theme.menuSecondary}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${theme.avatar}`}>
                    {initialsFor(displayName) || "?"}
                  </span>
                  Min översikt
                </Link>
                <div className="mt-3 flex flex-col">
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMenuOpen(false)}
                    className={`border-b py-3 text-left text-[15px] transition ${theme.menuItem}`}
                  >
                    Inställningar
                  </Link>
                  <Link
                    href="/dashboard/privacy"
                    onClick={() => setMenuOpen(false)}
                    className={`border-b py-3 text-left text-[15px] transition ${theme.menuItem}`}
                  >
                    Sekretess
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                      router.push("/");
                    }}
                    className={`flex items-center gap-2 py-3 text-left text-[15px] transition ${theme.danger}`}
                  >
                    <LogOutIcon className="h-4 w-4" />
                    Logga ut
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setAuthOpen(true);
                }}
                className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-[10px] border px-5 py-3 text-center text-sm font-semibold transition ${theme.menuSecondary}`}
              >
                <UserIcon className="h-4 w-4" />
                Logga in
              </button>
            )}
          </nav>
        )}
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <OnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </>
  );
}
