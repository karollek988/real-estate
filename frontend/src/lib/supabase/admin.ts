import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Service-role Supabase client for the server-side analysis pipeline.
 * The properties/analyses tables have RLS enabled with no policies, so this
 * client is the only way to reach them — browser clients must go through
 * the app's API routes.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must only be called on the server");
  }

  if (!adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable"
      );
    }
    adminClient = createSupabaseClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return adminClient;
}
