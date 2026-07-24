// Live coverage verification: re-runs the pipeline against properties
// ALREADY in the local Supabase DB (never fetches a fresh internet
// listing) — once with parsebot_booli disabled, once enabled — and reports
// the per-property field-coverage delta using buildPropertyOverview, the
// exact "Uppgift saknas" list lib/report/build.ts already renders.
//
// Uses proper module resolution (tsconfig `@/` path alias, extensionless
// imports) rather than raw `node --experimental-strip-types`, since
// store.ts imports via "@/lib/supabase/admin" — run with:
//   npx tsx src/lib/analysis/parseBotCoverage.verify.ts
//
// Requires local Supabase running and .env.local populated (respects the
// Parse.bot free tier: 100 credits/month, 5 req/min — VERIFY_LIMIT
// defaults to 10 properties, PROPERTY_DELAY_MS to 20s between calls).
process.loadEnvFile(".env.local");

import { createAdminClient } from "@/lib/supabase/admin";
import { rerunAnalysisForProperty } from "./pipeline";
import { getAnalysisWithProperty } from "./store";
import { buildPropertyOverview } from "@/lib/report/build";

const LIMIT = Number(process.env.VERIFY_LIMIT ?? 10);
// Optional: verify specific properties by id (comma-separated) instead of
// "most recently created N" — useful to target known-interesting cases.
const PROPERTY_IDS = (process.env.PROPERTY_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DELAY_MS = Number(process.env.PROPERTY_DELAY_MS ?? 20000);
const NA = "Uppgift saknas";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Parse.bot's endpoints measured live at 7-42s each (it's a live scraper,
// not a cached API) — get_listing_detail and search_sold_listings run
// concurrently but the pipeline still runs every other provider in the
// same request, so give this generous headroom over parseBotBooli.ts's
// own 45s per-request timeout.
async function waitForCompletion(analysisId: string, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await getAnalysisWithProperty(analysisId);
    if (row?.analysis.status === "complete") return row;
    if (row?.analysis.status === "failed") throw new Error(`Analysis ${analysisId} failed: ${row.analysis.error}`);
    await sleep(1000);
  }
  throw new Error(`Analysis ${analysisId} timed out`);
}

function coverage(report: unknown, attributes: Record<string, unknown>) {
  const rows = buildPropertyOverview(report as Parameters<typeof buildPropertyOverview>[0], attributes);
  const missing = rows.filter((r) => r.value === NA).map((r) => r.label);
  return { populated: rows.length - missing.length, total: rows.length, missing };
}

async function main() {
  const admin = createAdminClient();
  const query =
    PROPERTY_IDS.length > 0
      ? admin.from("properties").select("id, address").in("id", PROPERTY_IDS)
      : admin.from("properties").select("id, address").order("created_at", { ascending: false }).limit(LIMIT);
  const { data: properties, error } = await query;
  if (error) throw new Error(error.message);
  if (!properties || properties.length === 0) {
    console.log("No properties found in the local DB — nothing to verify.");
    return;
  }

  console.log(`Verifying ${properties.length} propert${properties.length === 1 ? "y" : "ies"}...\n`);
  let totalBefore = 0;
  let totalAfter = 0;

  for (const p of properties as { id: string; address: string }[]) {
    process.env.DISABLED_PROVIDERS = "parsebot_booli";
    const beforePending = await rerunAnalysisForProperty(p.id);
    if (!beforePending) {
      console.log(`${p.address}: property vanished mid-run, skipping`);
      continue;
    }
    const before = await waitForCompletion(beforePending.analysis.id);
    const beforeCov = coverage(before.analysis.report, before.property.attributes);

    delete process.env.DISABLED_PROVIDERS;
    await sleep(DELAY_MS);
    const afterPending = await rerunAnalysisForProperty(p.id);
    if (!afterPending) {
      console.log(`${p.address}: property vanished mid-run, skipping`);
      continue;
    }
    const after = await waitForCompletion(afterPending.analysis.id);
    const afterCov = coverage(after.analysis.report, after.property.attributes);

    const parsebotStatus =
      after.analysis.dataSources.find((s) => s.id === "parsebot_booli")?.status ?? "not_run";
    const parsebotDetail = after.analysis.dataSources.find((s) => s.id === "parsebot_booli")?.detail;
    const contributed = beforeCov.missing.filter((label) => !afterCov.missing.includes(label));

    totalBefore += beforeCov.populated;
    totalAfter += afterCov.populated;

    console.log(
      `${p.address}: ${beforeCov.populated}/${beforeCov.total} -> ${afterCov.populated}/${afterCov.total} (parsebot_booli: ${parsebotStatus}${parsebotDetail ? ` — ${parsebotDetail}` : ""})`
    );
    if (contributed.length > 0) console.log(`  contributed: ${contributed.join(", ")}`);
    if (afterCov.missing.length > 0) console.log(`  still missing: ${afterCov.missing.join(", ")}`);

    await sleep(DELAY_MS);
  }

  console.log(
    `\nTotal populated fields across ${properties.length} propert${properties.length === 1 ? "y" : "ies"}: ${totalBefore} -> ${totalAfter}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
