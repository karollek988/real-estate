"use client";

import { useEffect, useRef } from "react";

/**
 * Closes a popover (dropdown, search panel, user menu) when the user presses
 * Escape or presses anywhere outside `ref`. `onDismiss` learns which, so an
 * Escape can hand focus back to the button that opened the popover.
 */
export function useDismiss(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  onDismiss: (reason: "escape" | "outside") => void,
) {
  // Read through a ref so a new callback each render doesn't re-subscribe.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismissRef.current("outside");
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismissRef.current("escape");
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, ref]);
}
