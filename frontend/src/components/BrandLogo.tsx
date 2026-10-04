/**
 * The Köpanalys mark - a house outline with a rising bar chart inside - and
 * the "Köpanalys.se" wordmark, drawn after the landing-page design reference
 * (docs/design/landing-2026-10). Both take their colour from `currentColor`.
 */
export function BrandMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 44" fill="none" aria-hidden="true" {...props}>
      <path d="M10.5 41.6H4.6V16.9L20 4.4l15.4 12.5v24.8" stroke="currentColor" strokeWidth={2.9} strokeLinejoin="round" />
      <rect x="13.1" y="33.2" width="3.5" height="8.4" rx="0.9" fill="currentColor" />
      <rect x="19.1" y="28.6" width="3.5" height="13" rx="0.9" fill="currentColor" />
      <rect x="25.1" y="25.4" width="3.5" height="16.2" rx="0.9" fill="currentColor" />
    </svg>
  );
}

export function BrandLogo({ className = "", markClassName = "h-9 w-auto" }: { className?: string; markClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <BrandMark className={markClassName} />
      <span className="whitespace-nowrap font-bold tracking-[-0.03em]">
        Köpanalys<span className="text-[0.82em] font-medium tracking-[-0.01em]">.se</span>
      </span>
    </span>
  );
}
