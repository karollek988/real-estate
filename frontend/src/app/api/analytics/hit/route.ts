import { isAdminHost } from "@/lib/admin/host";
import { classifyDevice, isBot } from "@/lib/analytics/device";
import { recordPageView } from "@/lib/analytics/record";
import { stockholmDay } from "@/lib/analytics/day";
import { getVisitorKey, visitorHash } from "@/lib/analytics/visitor";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// The answer never says whether anything was counted: a script that probes this
// endpoint learns nothing, and the beacon doesn't read the response anyway.
const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/**
 * Counts one page view, anonymously (see lib/analytics/visitor.ts and the
 * migration for exactly what is and isn't kept). Called by PageViewTracker with
 * a one-field JSON body: whether the screen has touch, which is all it takes to
 * tell an iPad from a Mac.
 *
 * Not counted: requests that are not from this site's own pages, visitors who
 * send Do Not Track or Global Privacy Control, bots, and floods from one address.
 */
export async function POST(request: Request): Promise<Response> {
  const headers = request.headers;

  // The admin host has its own world; its pages never send this.
  if (isAdminHost(headers.get("host"))) return new Response("Not found", { status: 404 });

  // Only the site's own pages count: a script on another site can't add to the numbers.
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return noContent();

  // Respect the browser's own privacy signals.
  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1") return noContent();

  const userAgent = headers.get("user-agent");
  if (!userAgent || isBot(userAgent)) return noContent();

  const ip = clientIp(request);
  if (!checkRateLimit(`analytics:${ip}`, 120, 60_000)) return noContent();

  let touch = false;
  try {
    const body: unknown = JSON.parse((await request.text()).slice(0, 200));
    touch = typeof body === "object" && body !== null && (body as { t?: unknown }).t === 1;
  } catch {
    // no or unreadable body: count the view without the touch hint
  }

  const day = stockholmDay(new Date());
  await recordPageView(day, visitorHash(getVisitorKey(), day, ip, userAgent), classifyDevice(userAgent, headers.get("sec-ch-ua-mobile"), touch));
  return noContent();
}
