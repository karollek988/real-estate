import Image from "next/image";

/**
 * The Köpanalys logo: the real logo file (public/kopanalys-bostad-logo.png, cut
 * out of its white square by frontend/scripts/make-brand-assets.py) next to the
 * "Köpanalys.se" wordmark, as in the header reference
 * (docs/design/landing-2026-10/New-Header-Design.png). The wordmark takes its
 * colour from `currentColor`; the parent link carries the accessible name.
 */
export function BrandLogo({
  className = "",
  markClassName = "h-10 w-10",
  markSizes = "48px",
}: {
  className?: string;
  /** Rendered size of the round mark - give it a square size. */
  markClassName?: string;
  /** The mark's largest rendered width, so the browser picks a sharp but small file. */
  markSizes?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/images/kopanalys-logo-mark.png"
        alt=""
        width={512}
        height={512}
        sizes={markSizes}
        loading="eager"
        className={`shrink-0 select-none ${markClassName}`}
      />
      <span className="whitespace-nowrap font-bold tracking-[-0.03em]">
        Köpanalys<span className="text-[0.86em] font-medium tracking-[-0.01em] opacity-90">.se</span>
      </span>
    </span>
  );
}
