/**
 * What kind of device a page view came from, and whether it came from a person
 * at all. Both come from the User-Agent header (plus two small hints), which is
 * read to decide a category and then thrown away: it is never stored.
 */

export const DEVICE_TYPES = ["mobile", "tablet", "desktop"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

// Crawlers, link-preview fetchers, uptime monitors, scripts and headless browsers.
// The beacon only fires from a browser that ran our JavaScript, which already
// leaves out most of them; this catches the ones that do run it. (okhttp is
// deliberately not here: real Android apps use it.)
const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|facebookexternalhit|embedly|preview|monitor|uptime|pingdom|statuscake|curl\/|wget\/|python-requests|python-urllib|node-fetch|undici|axios\/|go-http-client|java\/|libwww|httpclient|scrapy|phantomjs|puppeteer|playwright|selenium|vercel|screenshot/i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // a real browser always names itself
  return BOT_PATTERN.test(userAgent);
}

const TABLET_PATTERN = /iPad|Tablet|PlayBook|Kindle|Silk\/|Android(?!.*Mobile)/i;
const MOBILE_PATTERN = /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|Opera Mini|BlackBerry/i;

/**
 * mobile / tablet / desktop.
 *
 * `chMobile` is the Sec-CH-UA-Mobile client hint ("?1" on a phone). `touch` is
 * the beacon's one bit of extra information, whether the screen has more than
 * one touch point: iPadOS 13 and later sends a Mac desktop User-Agent, and
 * touch is the only way to tell an iPad from a Mac.
 */
export function classifyDevice(userAgent: string, chMobile?: string | null, touch?: boolean): DeviceType {
  if (TABLET_PATTERN.test(userAgent)) return "tablet";
  if (/Macintosh/.test(userAgent) && touch) return "tablet";
  if (MOBILE_PATTERN.test(userAgent) || chMobile === "?1") return "mobile";
  return "desktop";
}
