"use client";

import { useEffect, useState } from "react";

interface CountUpProps {
  value: string;
  durationMs?: number;
}

/** Animates purely numeric values from 0 to their target; renders anything else as-is. */
export function CountUp({ value, durationMs = 800 }: CountUpProps) {
  const target = /^\d+$/.test(value.trim()) ? parseInt(value, 10) : null;
  const [display, setDisplay] = useState(target === null ? value : "0");

  useEffect(() => {
    if (target === null) {
      // Non-numeric values (e.g. a date string that starts as "—" while
      // still loading) don't animate — but the display must still follow
      // value on later renders, since useState's initializer only runs
      // once on mount and won't pick up a value that changes afterwards.
      setDisplay(value);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(String(target));
      return;
    }

    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(String(Math.round(eased * target)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, value]);

  return <>{display}</>;
}
