"use client";

import { useEffect } from "react";

/**
 * Browsers restore the previous scroll position on a page reload by
 * default - this opts out of that so a refresh always starts at the top.
 * Mounted once in the root layout, which the App Router never remounts on
 * client-side navigation, so this only ever runs on an actual page load.
 */
export function ScrollRestorationReset() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  return null;
}
