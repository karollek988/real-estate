/** Full-circle decision score ring for the cover — replaces a bare "72/100"
 *  with the same read-at-a-glance shape used across the product. Draws with
 *  the entrance animation defined once in globals.css (.score-ring-progress),
 *  which the PDF export route freezes to its end state before printing. */
export function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  const ringVars = {
    "--ring-circumference": circumference,
    "--ring-offset": offset,
  } as React.CSSProperties;

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center sm:h-36 sm:w-36">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="7" className="stroke-white/10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke="#D8B563"
          className="score-ring-progress"
          style={ringVars}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[34px] font-semibold leading-none tracking-tight text-white sm:text-[38px]">{score}</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[#8B9A8F]">av 100</span>
      </div>
    </div>
  );
}
