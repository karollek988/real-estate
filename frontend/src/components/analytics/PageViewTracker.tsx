"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const ENDPOINT = "/api/analytics/hit";

/** Visitors who have asked their browser not to be tracked are not counted at all. */
function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  return nav.doNotTrack === "1" || nav.msDoNotTrack === "1" || nav.globalPrivacyControl === true;
}

/**
 * Tells the site's own server that a page was shown, once per page, so it can
 * count visitors and what kind of device they use. Anonymous and cookieless:
 * nothing is stored on the visitor's device and the request carries no URL, no
 * identifier and nothing but one bit - whether the screen has touch (the
 * server uses it to tell an iPad from a Mac). What the server keeps, and for
 * how long, is described in lib/analytics/visitor.ts and on /privacy.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const lastCounted = useRef<string | null>(null);

  useEffect(() => {
    if (lastCounted.current === pathname) return; // React's double effect in development
    lastCounted.current = pathname;
    if (optedOut()) return;

    const body = JSON.stringify({ t: navigator.maxTouchPoints > 1 ? 1 : 0 });
    try {
      if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
    } catch {
      // fall through to fetch
    }
    fetch(ENDPOINT, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }, [pathname]);

  return null;
}
