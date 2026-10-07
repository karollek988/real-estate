import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { demoContent } from "./demo";
import type { ContentItem, ContentType } from "./model";
import { LIST_COLUMNS, PAGE_COLUMNS, rowToItem, type ContentRow } from "./rows";

/**
 * Published guides, insights and news for the public pages. Server-side.
 *
 * Reads with the public anon key and no session, so the database itself (the
 * RLS policy on content_items) decides what is visible: published items whose
 * publication time has come. A forgotten filter here could never leak a draft.
 * No cookies are read either, which keeps the pages static (rebuilt every few
 * minutes, and at once when the editor publishes - see revalidateContent).
 *
 * Until the migration has been run, or without Supabase settings, the lists
 * are empty and the pages show their empty states - plus the temporary demo
 * items in development and on Preview deployments (demo.ts).
 */

let client: SupabaseClient | null | undefined;

function publicClient(): SupabaseClient | null {
  if (client === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    client = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  }
  return client;
}

let warned = false;

function warnOnce(error: { message?: string; code?: string }) {
  if (warned) return;
  warned = true;
  console.warn(`Content is not available (${error.code || "error"}: ${error.message || "unknown"}); the Kunskap pages show no published items.`);
}

const MAX_ITEMS = 200;

/** Published items of one type, newest first, without their bodies. */
export async function listPublishedContent(type: ContentType): Promise<ContentItem[]> {
  const supabase = publicClient();
  let items: ContentItem[] = [];
  if (supabase) {
    const { data, error } = await supabase
      .from("content_items")
      .select(LIST_COLUMNS)
      .eq("type", type)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(MAX_ITEMS);
    if (error) warnOnce(error);
    else items = (data as unknown as ContentRow[]).map(rowToItem);
  }
  return [...items, ...demoContent(type).map((item) => ({ ...item, body: "" }))];
}

/** One published item with its body, or null. */
export async function getPublishedContent(type: ContentType, slug: string): Promise<ContentItem | null> {
  const demo = demoContent(type).find((item) => item.slug === slug);
  if (demo) return demo;

  const supabase = publicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("content_items")
    .select(PAGE_COLUMNS)
    .eq("type", type)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    warnOnce(error);
    return null;
  }
  return data ? rowToItem(data as unknown as ContentRow) : null;
}

/** The item to lead a hub with: the newest one marked as featured, otherwise the newest. */
export function pickFeatured(items: ContentItem[]): ContentItem | undefined {
  return items.find((item) => item.featured) ?? items[0];
}

/** Up to `count` other items, the same category first. */
export function relatedContent(item: ContentItem, all: ContentItem[], count = 3): ContentItem[] {
  return all
    .filter((other) => other.slug !== item.slug)
    .sort((a, b) => Number(b.category === item.category) - Number(a.category === item.category))
    .slice(0, count);
}
