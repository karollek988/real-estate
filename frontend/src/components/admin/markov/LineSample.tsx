/** A short piece of a chart line, for a legend: the same dash and weight as the line it stands for, in the colour of the surrounding series class. */
export function LineSample({ dash, heavy }: { dash?: string; heavy?: boolean }) {
  return (
    <svg className="markov-sample" width="26" height="10" viewBox="0 0 26 10" aria-hidden>
      <line x1="1" x2="25" y1="5" y2="5" strokeWidth={heavy ? 3.6 : 2.4} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}
