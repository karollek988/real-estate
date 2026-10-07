import { isAdminHost } from "@/lib/admin/host";
import { isBot } from "@/lib/analytics/device";
import { recordAcquisition, type AcquisitionEvent } from "@/lib/analytics/record";
import { stockholmDay } from "@/lib/analytics/day";
import { CHANNEL_IDS, type ChannelId } from "@/lib/markov/acquisition";
import { isKnownSource } from "@/lib/analytics/source";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Like the page-view beacon, the answer never says whether anything was recorded.
const noContent = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

const EVENTS: readonly AcquisitionEvent[] = ["accept", "decline", "arrive"];

/**
 * Records where a new visitor came from, or that someone declined the cookie banner - as anonymous daily
 * totals (see the migration 20261007000000_acquisition_analytics.sql for exactly what is kept). Called by
 * SourceTracker, and only after the visitor has accepted the analytics cookie, apart from the decline
 * count, which carries nothing but the fact. The body is {e, c, s}: the event, the channel and the source.
 *
 * Not recorded: requests that are not from this site's own pages, visitors who send Do Not Track or Global
 * Privacy Control, bots, floods from one address, and anything that is not one of the fixed channel and
 * source names (a script cannot put its own text in the database).
 */
export async function POST(request: Request): Promise<Response> {
  const headers = request.headers;

  if (isAdminHost(headers.get("host"))) return new Response("Not found", { status: 404 });

  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return noContent();

  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1") return noContent();

  const userAgent = headers.get("user-agent");
  if (!userAgent || isBot(userAgent)) return noContent();

  if (!checkRateLimit(`acquisition:${clientIp(request)}`, 30, 60_000)) return noContent();

  let body: { e?: unknown; c?: unknown; s?: unknown };
  try {
    const parsed: unknown = JSON.parse((await request.text()).slice(0, 300));
    if (typeof parsed !== "object" || parsed === null) return noContent();
    body = parsed as typeof body;
  } catch {
    return noContent();
  }

  const event = EVENTS.find((candidate) => candidate === body.e);
  if (!event) return noContent();
  const day = stockholmDay(new Date());

  if (event === "decline") {
    await recordAcquisition(day, "decline", null, null);
    return noContent();
  }

  const channel = CHANNEL_IDS.find((candidate): candidate is ChannelId => candidate === body.c);
  if (!channel) return noContent();
  const source = typeof body.s === "string" && isKnownSource(channel, body.s) ? body.s : "other";
  await recordAcquisition(day, event, channel, source);
  return noContent();
}
