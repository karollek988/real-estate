"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/AuthModal";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { MenuIcon, CloseIcon, LogOutIcon } from "@/components/icons";
import { OPEN_ONBOARDING_MODAL_EVENT } from "@/lib/onboardingModalEvents";

type NavAction =
  | { type: "modal" }
  | { type: "scroll"; targetId: string }
  | { type: "link"; href: string };

const NAV_ITEMS: { label: string; action: NavAction }[] = [
  { label: "Startsida", action: { type: "link", href: "/" } },
  { label: "Så fungerar det", action: { type: "modal" } },
  { label: "Exempelrapport", action: { type: "scroll", targetId: "marknadsinsikter" } },
  { label: "Priser", action: { type: "scroll", targetId: "analyze" } },
  { label: "FAQ", action: { type: "scroll", targetId: "faq" } },
  { label: "Kontakt", action: { type: "link", href: "/contact" } },
];

const SCROLL_SPY_IDS = ["analyze", "marknadsinsikter", "faq"];

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
  onOnboardingOpen,
  onNavigate,
  className,
}: {
  label: string;
  action: NavAction;
  active: boolean;
  onOnboardingOpen: () => void;
  onNavigate?: () => void;
  className: string;
}) {
  if (action.type === "link") {
    return (
      <Link href={action.href} onClick={onNavigate} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (action.type === "modal") onOnboardingOpen();
        else scrollToSection(action.targetId);
        onNavigate?.();
      }}
      className={`${className} ${active ? "text-white" : ""}`}
    >
      {label}
    </button>
  );
}

function UserDropdown({ label }: { label: string }) {
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
    { label: "Besiktningshjälp", href: "/dashboard/inspection" },
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
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-green-500/30 bg-green-400/10 text-sm font-semibold text-green-400 transition hover:border-green-500/50 hover:bg-green-400/15"
      >
        {initialsFor(label) || "?"}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0F1417] backdrop-blur-xl">
          {items.map((item, i) =>
            item.label === "—" ? (
              <div key={i} className="mx-3 border-t border-white/10" />
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
                  item.danger
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-neutral-300 hover:bg-white/5 hover:text-white"
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

export function SiteHeader() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { user, signOut } = useAuth();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "";

  useEffect(() => {
    const onOpenOnboarding = () => setOnboardingOpen(true);
    window.addEventListener(OPEN_ONBOARDING_MODAL_EVENT, onOpenOnboarding);
    return () => window.removeEventListener(OPEN_ONBOARDING_MODAL_EVENT, onOpenOnboarding);
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
        }
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0F0D]">
        <div className="mx-auto flex h-[68px] w-full max-w-[1400px] items-center justify-between px-5 lg:h-[84px] lg:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/kopanalys-bostad-logo.png"
              alt="Köpanalys"
              width={72}
              height={72}
              priority
              className="h-9 w-9 rounded-full"
            />
            <span className="text-lg font-semibold tracking-tight">Köpanalys</span>
          </Link>
          <nav className="hidden items-center gap-9 lg:flex">
            {NAV_ITEMS.map(({ label, action }) => (
              <NavLink
                key={label}
                label={label}
                action={action}
                active={action.type === "scroll" && activeSection === action.targetId}
                onOnboardingOpen={() => setOnboardingOpen(true)}
                className="cursor-pointer text-sm text-neutral-300 transition hover:text-white"
              />
            ))}
            {user ? (
              <UserDropdown label={displayName} />
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="cursor-pointer rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200"
              >
                Logga in
              </button>
            )}
          </nav>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Stäng meny" : "Öppna meny"}
            aria-expanded={menuOpen}
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-white transition hover:bg-white/5 lg:hidden"
          >
            {menuOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-7 w-7" />}
          </button>
        </div>
        {menuOpen && (
          <nav className="absolute inset-x-0 top-full flex flex-col border-b border-white/10 bg-[#0A0F0D]/95 px-5 pb-6 pt-1 backdrop-blur-xl lg:hidden">
            {NAV_ITEMS.map(({ label, action }) => (
              <NavLink
                key={label}
                label={label}
                action={action}
                active={action.type === "scroll" && activeSection === action.targetId}
                onOnboardingOpen={() => setOnboardingOpen(true)}
                onNavigate={() => setMenuOpen(false)}
                className="cursor-pointer border-b border-white/5 py-3.5 text-left text-[15px] text-neutral-300 transition hover:text-white"
              />
            ))}
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="mt-5 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-green-500/30 bg-green-400/10 text-xs font-semibold text-green-400">
                    {initialsFor(displayName) || "?"}
                  </span>
                  Min översikt
                </Link>
                <div className="mt-3 flex flex-col">
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMenuOpen(false)}
                    className="border-b border-white/5 py-3 text-left text-[15px] text-neutral-300 transition hover:text-white"
                  >
                    Inställningar
                  </Link>
                  <Link
                    href="/dashboard/privacy"
                    onClick={() => setMenuOpen(false)}
                    className="border-b border-white/5 py-3 text-left text-[15px] text-neutral-300 transition hover:text-white"
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
                    className="flex items-center gap-2 border-b border-white/5 py-3 text-left text-[15px] text-red-400 transition hover:text-red-300"
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
                className="mt-5 cursor-pointer rounded-lg bg-white px-5 py-3 text-center text-sm font-semibold text-neutral-900 transition hover:bg-neutral-200"
              >
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
