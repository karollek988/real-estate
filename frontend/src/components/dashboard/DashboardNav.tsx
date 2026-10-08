"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { HouseIcon, ShieldIcon, SettingsIcon, CreditCardIcon, TicketIcon } from "@/components/icons";

/** The tabs. Their names: dashboard.nav.<id> */
const NAV_ITEMS = [
  { id: "overview", href: "/dashboard", icon: HouseIcon },
  { id: "inspection", href: "/dashboard/inspection", icon: ShieldIcon },
  { id: "settings", href: "/dashboard/settings", icon: SettingsIcon },
  { id: "coupons", href: "/dashboard/coupons", icon: TicketIcon },
  { id: "purchases", href: "/dashboard/subscriptions", icon: CreditCardIcon },
] as const;

export function DashboardNav() {
  const t = useTranslations("dashboard.nav");
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
    <nav className="border-b border-ka-line bg-ka-paper">
      <div
        ref={listRef}
        className="relative mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto px-5 lg:gap-2 lg:px-6"
      >
        {NAV_ITEMS.map((item) => {
          const { id, href, icon: Icon } = item;
          const isActive = pathname === href;
          return (
            <Link
              key={id}
              href={href}
              data-active={isActive ? "true" : undefined}
              className={`dash-tab relative flex shrink-0 items-center gap-2 px-3.5 py-3.5 text-sm font-medium ${
                isActive ? "text-ka-ink" : "text-ka-muted hover:text-ka-ink"
              }`}
            >
              <Icon className={`dash-tab-icon h-[17px] w-[17px] ${isActive ? "text-ka-green-700" : ""}`} />
              {t(id)}
            </Link>
          );
        })}
        <span
          aria-hidden
          className={`dash-nav-indicator absolute bottom-0 left-0 h-[2px] rounded-full bg-ka-green-700 ${
            indicator ? "opacity-100" : "opacity-0"
          }`}
          style={indicator ? { width: indicator.width, transform: `translateX(${indicator.left}px)` } : undefined}
        />
      </div>
    </nav>
  );
}
