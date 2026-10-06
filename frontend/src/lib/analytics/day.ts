const STOCKHOLM_DAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * The calendar day (YYYY-MM-DD) in Sweden, which is how the site's days are counted.
 * Kept apart from visitor.ts (which needs Node's crypto) so the admin page's
 * browser code can use it too.
 */
export function stockholmDay(date: Date): string {
  return STOCKHOLM_DAY.format(date);
}
