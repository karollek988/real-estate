/**
 * A short handwritten margin note with a drawn arrow, as in the Bostadsguiden
 * reference: a human aside next to the editorial type. Needs the `font-hand`
 * variable (lib/fonts.ts `handwriting`) on a wrapper. The arrow is decoration.
 *
 *  arrow "down-right" - under the text, curving down and to the right
 *  arrow "left"       - before the text, pointing up and back at the button above it
 */
export function HandNote({
  children,
  arrow = "down-right",
  className = "",
}: {
  children: React.ReactNode;
  arrow?: "down-right" | "left";
  className?: string;
}) {
  const text = <p className="font-hand text-[23px] font-semibold leading-[1.02] text-ka-green-900">{children}</p>;

  if (arrow === "left") {
    return (
      <div className={`pointer-events-none flex select-none items-start gap-2 ${className}`}>
        <svg
          aria-hidden
          viewBox="0 0 64 40"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="-mt-2 h-9 w-14 shrink-0 text-ka-green-800"
        >
          <path d="M60 34C46 36 34 30 26 20c-4-5-9-9-18-11" />
          <path d="M15 16l-8-7 10-3" />
        </svg>
        {text}
      </div>
    );
  }

  return (
    <div className={`pointer-events-none select-none ${className}`}>
      {text}
      <svg
        aria-hidden
        viewBox="0 0 80 60"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ml-auto mt-1 h-11 w-16 -scale-x-100 text-ka-green-800"
      >
        <path d="M62 4C66 22 56 40 30 48c-6 2-12 3-18 3" />
        <path d="M20 42l-9 9 11 5" />
      </svg>
    </div>
  );
}
