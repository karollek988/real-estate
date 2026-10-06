/**
 * Sample numbers for looking at the statistics page without a database, switched
 * on with ADMIN_STATS_DEMO=1 in development only (statsData.ts refuses it in
 * production). The page labels itself as demo data when these are shown.
 *
 * Deterministic: the same day gives the same numbers, so screenshots and tests repeat.
 */
import { HISTORY_DAYS, addDays, type AdminStats, type DayStats, type PackageKey } from "./stats";
import { DEVICE_TYPES, type DeviceType } from "@/lib/analytics/device";

/** mulberry32: a small seeded random number generator. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEVICE_SHARE: Record<DeviceType, number> = { mobile: 0.62, desktop: 0.3, tablet: 0.08 };
const PACKAGE_SHARE: [PackageKey, number][] = [
  ["omradesanalys", 0.24],
  ["trygghetspaket", 0.6],
  ["tre_bostader", 0.14],
  ["other", 0.02],
];
// Monday first; weekends are quieter for a service people use while they work through listings.
const WEEKDAY_FACTOR = [1.05, 1.1, 1.08, 1.04, 0.95, 0.78, 0.84];

export function buildDemoStats(today: string, generatedAt: string): AdminStats {
  const days: DayStats[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const day = addDays(today, -(HISTORY_DAYS - 1 - i));
    const rand = random(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
    const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
    const growth = 55 + (i / HISTORY_DAYS) * 95; // from about 55 to 150 visitors a day
    const total = Math.round(growth * WEEKDAY_FACTOR[weekday] * (0.82 + rand() * 0.36));

    const visitors = { mobile: 0, tablet: 0, desktop: 0 };
    const pageViews = { mobile: 0, tablet: 0, desktop: 0 };
    for (const device of DEVICE_TYPES) {
      visitors[device] = Math.round(total * DEVICE_SHARE[device] * (0.9 + rand() * 0.2));
      // desktop visitors read further than phone visitors do
      pageViews[device] = Math.round(visitors[device] * ((device === "desktop" ? 3.4 : device === "tablet" ? 2.8 : 2.2) + rand() * 0.8));
    }

    const purchases = { omradesanalys: 0, trygghetspaket: 0, tre_bostader: 0, other: 0 };
    const buyers = visitors.mobile + visitors.tablet + visitors.desktop;
    const count = Math.round(buyers * 0.014 * (0.4 + rand() * 1.2)); // about 1.4 purchases per 100 visitors, varying
    for (let p = 0; p < count; p++) {
      let r = rand();
      for (const [key, share] of PACKAGE_SHARE) {
        if (r < share) { purchases[key] += 1; break; }
        r -= share;
      }
    }
    days.push({ day, visitors, pageViews, purchases });
  }
  return { today, generatedAt, days, trackingSince: days[0].day, demo: true };
}
