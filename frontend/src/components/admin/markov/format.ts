/** How the simulator writes money and shares: Swedish, with a real minus sign and a non-breaking space before the unit. */
import { formatDecimal, formatInt } from "@/lib/admin/stats";

/** 12345.6 -> "12 346 kr", -50 -> "−50 kr" */
export const kr = (value: number) => `${formatInt(value).replace("-", "−")} kr`;

/** 6.06 -> "6,1 kr": for the small amounts of one purchase */
export const krDecimal = (value: number) => `${formatDecimal(value).replace("-", "−")} kr`;

/** 0.033 -> "3,3 %" */
export const sharePercent = (fraction: number) => `${formatDecimal(fraction * 100).replace("-", "−")} %`;
