"use client";

import { useEffect, useRef, useState } from "react";

type RevealVariant = "up" | "left" | "right" | "fade";

export function Reveal({
  children,
  variant = "up",
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  variant?: RevealVariant;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Toggle with hysteresis: animate in at >=12% visible, fade back out
    // only once fully out of view, so edge scrolling never flickers.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.12) {
          setVisible(true);
        } else if (!entry.isIntersecting) {
          setVisible(false);
        }
      },
      { threshold: [0, 0.12], rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal reveal-${variant} ${visible ? "is-visible" : ""} ${className}`}
      style={delay ? { transitionDelay: visible ? `${delay}ms` : "0ms" } : undefined}
    >
      {children}
    </div>
  );
}
