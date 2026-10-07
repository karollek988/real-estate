/**
 * Reads what the statistics page shows. Server only: it uses the service-role
 * client, and runs while the admin page is being built for a signed-in admin
 * (pages/admin-portal), never for anyone else.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { stockholmDay } from "@/lib/analytics/day";
import { HISTORY_DAYS, addDays, buildDays, type AdminStatsResult, type DailyRow, type PurchaseRow } from "./stats";
import { buildDemoStats } from "./statsDemo";

// PostgREST answers at most 1000 rows to one request and says nothing when it stops there, so the
// ledger is read a page at a time. The page limit is a backstop, far above any plausible number
// of purchases in half a year; reaching it is reported, never shown as a smaller total.
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

export type Failure = { message: string; code?: string };

// Postgres "undefined_table" and PostgREST's "not in the schema cache": the migration is missing.
export const isMissingTable = (error: Failure) =>
  error.code === "42P01" || error.code === "PGRST205" || /could not find the table|does not exist/i.test(error.message);

async function fetchPurchases(client: SupabaseClient, since: string): Promise<{ rows: PurchaseRow[] } | { error: Failure }> {
  const rows: PurchaseRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await client
      .from("credit_purchases")
      .select("price_key, created_at")
      .gte("created_at", since)
      // the session id breaks ties, so pages never overlap or skip a row
      .order("created_at", { ascending: true })
      .order("stripe_session_id", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) return { error };
    rows.push(...((data ?? []) as PurchaseRow[]));
    if ((data?.length ?? 0) < PAGE_SIZE) return { rows };
  }
  return { error: { message: `Fler än ${MAX_PAGES * PAGE_SIZE} köp i perioden: sidan behöver ett annat sätt att räkna dem.` } };
}

export async function loadAdminStats(now: Date = new Date()): Promise<AdminStatsResult> {
  const today = stockholmDay(now);

  // Development only: realistic made-up numbers, to look at the page without a database.
  if (process.env.NODE_ENV !== "production" && process.env.ADMIN_STATS_DEMO === "1") {
    return { status: "ok", stats: buildDemoStats(today, now.toISOString()) };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { status: "unconfigured" };

  try {
    const client = createAdminClient();
    const firstDay = addDays(today, -(HISTORY_DAYS - 1));
    // A Swedish day starts at 22:00 or 23:00 UTC the evening before: ask from a day early and let buildDays drop the extra.
    const purchasesSince = `${addDays(firstDay, -1)}T00:00:00Z`;

    const [daily, purchases, earliest] = await Promise.all([
      // 3 device types a day for HISTORY_DAYS days: well under the 1000-row limit
      client.from("analytics_daily").select("day, device, visitors, page_views").gte("day", firstDay).limit(HISTORY_DAYS * 3),
      fetchPurchases(client, purchasesSince),
      client.from("analytics_daily").select("day").order("day", { ascending: true }).limit(1),
    ]);

    const failure = daily.error ?? ("error" in purchases ? purchases.error : null) ?? earliest.error;
    if (failure) return isMissingTable(failure) ? { status: "missing_tables" } : { status: "error", message: failure.message };

    return {
      status: "ok",
      stats: {
        today,
        generatedAt: now.toISOString(),
        days: buildDays((daily.data ?? []) as DailyRow[], "rows" in purchases ? purchases.rows : [], today),
        trackingSince: (earliest.data?.[0]?.day as string | undefined) ?? null,
        demo: false,
      },
    };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Okänt fel" };
  }
}
