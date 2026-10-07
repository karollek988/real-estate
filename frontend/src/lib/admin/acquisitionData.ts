/**
 * Reads what the site has measured about where new visitors come from, for the Markov simulator's
 * acquisition model. Server only: it uses the service-role client and runs while the admin page is being
 * built for a signed-in admin (pages/admin-portal), never for anyone else.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { stockholmDay } from "@/lib/analytics/day";
import { WINDOW_DAYS, buildMeasured, shiftDay, type ArrivalRow, type ConsentRow, type MeasuredResult } from "@/lib/markov/measured";
import { buildDemoMeasured } from "./acquisitionDemo";
import { isMissingTable } from "./statsData";

// PostgREST answers at most 1000 rows to one request and says nothing when it stops there. The window is
// WINDOW_DAYS long and the sources are a short fixed list (30 combinations), so 900 rows is the most there
// can be; reaching 1000 is reported rather than shown as a smaller total.
const ROW_LIMIT = 1000;

export async function loadMeasuredAcquisition(now: Date = new Date()): Promise<MeasuredResult> {
  const today = stockholmDay(now);

  if (process.env.NODE_ENV !== "production" && process.env.ADMIN_STATS_DEMO === "1") {
    return { status: "ok", measured: buildDemoMeasured(today) };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { status: "unconfigured" };

  try {
    const client = createAdminClient();
    const from = shiftDay(today, -(WINDOW_DAYS - 1));
    const [arrivals, consent, firstArrival, firstConsent] = await Promise.all([
      client.from("analytics_arrivals_daily").select("day, channel, source, visitors").gte("day", from).limit(ROW_LIMIT),
      client.from("analytics_consent_daily").select("day, accepted, declined").gte("day", from).limit(ROW_LIMIT),
      client.from("analytics_arrivals_daily").select("day").order("day", { ascending: true }).limit(1),
      client.from("analytics_consent_daily").select("day").order("day", { ascending: true }).limit(1),
    ]);

    const failure = arrivals.error ?? consent.error ?? firstArrival.error ?? firstConsent.error;
    if (failure) return isMissingTable(failure) ? { status: "missing_tables" } : { status: "error", message: failure.message };
    if ((arrivals.data?.length ?? 0) >= ROW_LIMIT || (consent.data?.length ?? 0) >= ROW_LIMIT) {
      return { status: "error", message: "För många rader för perioden: sidan behöver ett annat sätt att summera dem." };
    }

    const firstDays = [firstArrival.data?.[0]?.day, firstConsent.data?.[0]?.day].filter((day): day is string => typeof day === "string").sort();
    return {
      status: "ok",
      measured: buildMeasured((arrivals.data ?? []) as ArrivalRow[], (consent.data ?? []) as ConsentRow[], firstDays[0] ?? null, today),
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Okänt fel" };
  }
}
