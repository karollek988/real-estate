/** Centered, low-opacity page mark — present but never competing with the
 *  content or the print layout. */
export function Watermark({ dark = false }: { dark?: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 flex select-none items-center justify-center overflow-hidden`}
    >
      <span
        className={`rotate-[-24deg] whitespace-nowrap text-[64px] font-semibold tracking-tight ${
          dark ? "text-white/[0.035]" : "text-[#12271D]/[0.035]"
        }`}
      >
        kopanalys.se
      </span>
    </div>
  );
}
