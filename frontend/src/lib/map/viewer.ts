import { createClient } from "@/lib/supabase/server";

/** Who is asking, if anyone: the signed-in user's id. The map can be looked at without an account. */
export async function viewerId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A listing id from a URL: only a real uuid goes on to the database. */
export function isListingId(value: string): boolean {
  return UUID.test(value);
}
