import { createAdminClient } from "@/lib/supabase/admin";
import type { DeviceType } from "./device";

let warned = false;

/**
 * Counts one page view (record_page_view, see the migration). It never throws:
 * the visitor is not waiting for it and a statistics failure must not become a
 * site failure. The first failure is logged, the rest are silent, so a database
 * that is down - or a migration that has not been applied yet - does not flood
 * the log with one line per page view.
 */
export async function recordPageView(day: string, visitor: string, device: DeviceType): Promise<void> {
  try {
    const { error } = await createAdminClient().rpc("record_page_view", { p_day: day, p_visitor: visitor, p_device: device });
    if (error) throw new Error(error.message);
  } catch (error) {
    if (!warned) {
      warned = true;
      console.error("[analytics] page view not counted:", error instanceof Error ? error.message : error);
    }
  }
}
