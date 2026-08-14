"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { HouseIcon, ShieldIcon, SettingsIcon, CreditCardIcon, TicketIcon } from "@/components/icons";

const NAV_ITEMS = [
  { label: "Översikt", href: "/dashboard", icon: HouseIcon },
  { label: "Visningsguide", href: "/dashboard/inspection", icon: ShieldIcon },
  { label: "Inställningar", href: "/dashboard/settings", icon: SettingsIcon },
  { label: "Kuponger", href: "/dashboard/coupons", icon: TicketIcon },
  { label: "Prenumerationer", href: "/dashboard/subscriptions", icon: CreditCardIcon },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

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
          const isActive = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              data-active={isActive ? "true" : undefined}
              className={`dash-tab relative flex shrink-0 items-center gap-2 px-3.5 py-3.5 text-sm font-medium ${
                isActive ? "text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Icon className={`dash-tab-icon h-[17px] w-[17px] ${isActive ? "text-green-400" : ""}`} />
              {label}
            </Link>
          );
        })}
        <span
          aria-hidden
          className={`dash-nav-indicator absolute bottom-0 left-0 h-[2px] rounded-full bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.4)] ${
            indicator ? "opacity-100" : "opacity-0"
          }`}
          style={indicator ? { width: indicator.width, transform: `translateX(${indicator.left}px)` } : undefined}
        />
      </div>
    </nav>
  );
}
