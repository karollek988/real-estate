function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

/** Half-circle speedometer gauge — a needle position is a much stronger read
 *  than a bare "1,8%" for a value that only means something relative to a
 *  low/high range (e.g. the policy rate). Draws with the same entrance
 *  animation as ScoreRing (.score-ring-progress in globals.css). */
export function ArcGauge({
  value,
  min,
  max,
  valueLabel,
  caption,
  lowLabel,
  highLabel,
}: {
  value: number;
  min: number;
  max: number;
  valueLabel: string;
  caption: string;
  lowLabel: string;
  highLabel: string;
}) {
  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 54;
  const cx = 60;
  const cy = 62;
  const trackPath = arcPath(cx, cy, r, 0, 180);
  const circumference = Math.PI * r;
  // trackPath runs from the HIGH end (angle 180) to the LOW end (angle 0) —
  // see arcPath/polarToCartesian above. A plain `circumference * (1 - fraction)`
  // offset (the usual full-circle progress-ring formula) would then reveal
  // the segment adjacent to the path's start, i.e. the HIGH end, so a low
  // value would wrongly show its fill next to "Hög" instead of next to the
  // needle. Negating it reveals the segment adjacent to the path's end (the
  // LOW end) instead, growing toward the needle as fraction increases.
  const offset = -(circumference * (1 - fraction));
  const needleAngle = fraction * 180;
  const needleEnd = polarToCartesian(cx, cy, r - 10, needleAngle);

  const ringVars = {
    "--ring-circumference": circumference,
    "--ring-offset": offset,
  } as React.CSSProperties;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 68" className="w-full max-w-[180px]">
        <path d={trackPath} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className="text-black/[0.07]" />
        <path
          d={trackPath}
          fill="none"
          stroke="#B98A2E"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="score-ring-progress"
          style={ringVars}
        />
        <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y} stroke="#12271D" strokeWidth="2" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3" fill="#12271D" />
      </svg>
      <p style={{ marginTop: "-0.5rem" }} className="text-[22px] font-semibold tracking-tight text-[#12271D]">
        {valueLabel}
      </p>
      <p className="text-[11px] text-[#8C8471]">{caption}</p>
      <div className="mt-2 flex w-full max-w-[180px] justify-between text-[10px] uppercase tracking-wide text-[#8C8471]">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
