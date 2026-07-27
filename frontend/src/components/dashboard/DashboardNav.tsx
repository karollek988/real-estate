"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { HouseIcon, ShieldIcon, SettingsIcon, CreditCardIcon, CrownIcon } from "@/components/icons";

const NAV_ITEMS = [
  { label: "Översikt", href: "/dashboard", icon: HouseIcon },
  { label: "Besiktningshjälp", href: "/dashboard/inspection", icon: ShieldIcon, premium: true },
  { label: "Inställningar", href: "/dashboard/settings", icon: SettingsIcon },
  { label: "Prenumerationer", href: "/dashboard/subscriptions", icon: CreditCardIcon },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const activeItem = NAV_ITEMS.find((item) => item.href === pathname);
  const activeIsPremium = !!activeItem && "premium" in activeItem && activeItem.premium;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const update = () => {
      const active = list.querySelector<HTMLAnchorElement>('a[data-active="true"]');
      if (!active) {
        setIndicator(null);
        return;
      }
      // Inset the underline to match the tab's horizontal padding (px-3.5 = 14px)
      setIndicator({ left: active.offsetLeft + 14, width: active.offsetWidth - 28 });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(list);
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <nav className="border-b border-white/10 bg-[#0A0F0D]">
      <div
        ref={listRef}
        className="relative mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto px-5 lg:gap-2 lg:px-6"
      >
        {NAV_ITEMS.map((item) => {
          const { label, href, icon: Icon } = item;
          const premium = "premium" in item && item.premium;
          const isActive = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              data-active={isActive ? "true" : undefined}
              className={`dash-tab ${premium ? "dash-tab-premium" : ""} relative flex shrink-0 items-center gap-2 px-3.5 py-3.5 text-sm font-medium ${
                isActive
                  ? "text-white"
                  : premium
                    ? "text-amber-300/90 hover:text-amber-200"
                    : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Icon
                className={`dash-tab-icon h-[17px] w-[17px] ${
                  premium ? "text-amber-400" : isActive ? "text-green-400" : ""
                }`}
              />
              {label}
              {premium && (
                <>
                  <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    <CrownIcon className="h-3 w-3 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]" />
                    Premium
                  </span>
                  <span aria-hidden className="dash-shimmer" />
                </>
              )}
            </Link>
          );
        })}
        <span
          aria-hidden
          className={`dash-nav-indicator absolute bottom-0 left-0 h-[2px] rounded-full ${
            activeIsPremium
              ? "bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.45)]"
              : "bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.4)]"
          } ${indicator ? "opacity-100" : "opacity-0"}`}
          style={indicator ? { width: indicator.width, transform: `translateX(${indicator.left}px)` } : undefined}
        />
      </div>
    </nav>
  );
}
