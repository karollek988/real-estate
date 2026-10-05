"use client";

import { FOCUS_URL_INPUT_EVENT } from "@/lib/onboardingModalEvents";

export type AnalysisMethod = "screenshot" | "manual" | "area";

/**
 * In-page link on the landing page. Scrolls smoothly instead of jumping, and
 * when it points at the analysis card it asks AnalyzeSection to open a given
 * tab (via the same event the onboarding modal uses). Before hydration, or
 * with a modifier key held, it is a plain anchor.
 */
export function ScrollLink({
  target,
  analysisMethod,
  className,
  children,
  ...rest
}: {
  target: string;
  analysisMethod?: AnalysisMethod;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  return (
    <a
      href={`#${target}`}
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (analysisMethod) {
          window.dispatchEvent(new CustomEvent(FOCUS_URL_INPUT_EVENT, { detail: { method: analysisMethod } }));
        } else {
          document.getElementById(target)?.scrollIntoView({ behavior: "smooth" });
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
