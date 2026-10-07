"use client";

import { useEffect } from "react";
import { CONSENT_CHANGED_EVENT, getCookieConsent, type ConsentChange } from "@/lib/consent";
import { classifySource, type SourceInfo } from "@/lib/analytics/source";
import { clearedSourceCookieText, privacySignalOn, readSourceCookie, sourceCookieText } from "@/lib/analytics/sourceCookie";

const ENDPOINT = "/api/analytics/arrival";

/**
 * Where this visit came from, worked out once when the page is first loaded and kept in memory: the
 * referrer is only there on the first page, and nothing may be stored on the device before consent.
 * (A visitor who decides on a later page after a full page load - not a client-side navigation - has
 * lost it: the referrer is then the site itself, and they count as "direct".)
 */
let landing: SourceInfo | null = null;
function landingSource(): SourceInfo {
  landing ??= classifySource({ referrer: document.referrer, search: window.location.search, ownHosts: [window.location.hostname] });
  return landing;
}

type Hit = "accept" | "decline" | "arrive";

function send(event: Hit, source?: SourceInfo) {
  const body = JSON.stringify({ e: event, c: source?.channel, s: source?.source });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // fall through to fetch
  }
  fetch(ENDPOINT, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}

const isSecure = () => window.location.protocol === "https:";
const clearCookie = () => {
  if (readSourceCookie(document.cookie)) document.cookie = clearedSourceCookieText(isSecure());
};

/**
 * The analytics cookie, and the anonymous counting that goes with it. Only for a visitor who has accepted
 * "analys och marknadsföring" in the cookie banner (and has not asked their browser not to be tracked):
 *
 *   accepts           -> ka_src is set to where they first came from, and that one new visitor is counted
 *   already accepted  -> nothing, as long as the cookie is there; if it has expired (90 days) they count as
 *                        a new visitor again
 *   declines / reopens the choice -> the cookie is removed; a decline is counted too (no cookie, no
 *                        identifier: only that someone declined), so the numbers can be scaled up to everyone
 *
 * What is sent, and what the server keeps, is only the channel and source name; see lib/analytics/source.ts.
 */
export function SourceTracker() {
  useEffect(() => {
    function settle(change?: ConsentChange) {
      if (privacySignalOn()) {
        clearCookie();
        return;
      }
      const consent = getCookieConsent();
      if (consent?.marketing === true) {
        if (readSourceCookie(document.cookie)) return;
        const source = landingSource();
        document.cookie = sourceCookieText(source, isSecure());
        send(change?.marketing === true ? "accept" : "arrive", source);
        return;
      }
      clearCookie();
      if (change?.marketing === false) send("decline");
    }

    landingSource(); // before anything else: the address may change as the visitor moves around
    settle();
    const onChange = (event: Event) => settle((event as CustomEvent<ConsentChange>).detail);
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
  }, []);

  return null;
}
