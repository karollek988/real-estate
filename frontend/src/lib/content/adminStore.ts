import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { LOCALE_CODES } from "@/i18n/locales";
import { getPathname } from "@/i18n/navigation";
import { translateOnPublish } from "@/lib/translate/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { readingMinutesFor, type ContentInput, type ContentItem } from "./model";
import { contentHref, contentLink, hubLink } from "./paths";
import { inputToColumns, LIST_COLUMNS, PAGE_COLUMNS, rowToItem, type ContentRow } from "./rows";

/**
 * Reading and writing content for the editor (/admin/content). Server-only,
 * with the service role, and only ever called after requireAdmin() /
 * isAdminUser() has accepted the signed-in user: the table has no write
 * policies, so nothing else can change it.
 */

export class ContentStoreError extends Error {
  constructor(
    readonly code: "not_found" | "not_draft" | "slug_taken" | "missing_table" | "database",
    message: string,
  ) {
    super(message);
  }
}

function toStoreError(error: { code?: string; message: string }): ContentStoreError {
  if (error.code === "23505") return new ContentStoreError("slug_taken", "Det finns redan innehåll med den adressen. Välj en annan slug.");
  if (error.code === "42P01" || error.code === "PGRST205") {
    return new ContentStoreError("missing_table", "Tabellen content_items finns inte ännu. Kör migreringen 20261007120000_content_items.sql i Supabase.");
  }
  return new ContentStoreError("database", error.message);
}

export async function listAllContent(): Promise<ContentItem[]> {
  const { data, error } = await createAdminClient().from("content_items").select(LIST_COLUMNS).order("updated_at", { ascending: false }).limit(500);
  if (error) throw toStoreError(error);
  return (data as unknown as ContentRow[]).map(rowToItem);
}

export async function getContentById(id: string): Promise<ContentItem | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await createAdminClient().from("content_items").select(PAGE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw toStoreError(error);
  return data ? rowToItem(data as unknown as ContentRow) : null;
}

function columnsFor(input: ContentInput) {
  return { ...inputToColumns(input), reading_minutes: input.readingMinutes ?? readingMinutesFor(input.body) };
}

export async function createContent(input: ContentInput, publish: boolean, userId: string): Promise<ContentItem> {
  const now = new Date().toISOString();
  const { data, error } = await createAdminClient()
    .from("content_items")
    .insert({
      ...columnsFor(input),
      status: publish ? "published" : "draft",
      published_at: publish ? now : null,
      created_by: userId,
      updated_by: userId,
    })
    .select(PAGE_COLUMNS)
    .single();
  if (error) throw toStoreError(error);
  const item = rowToItem(data as unknown as ContentRow);
  revalidateContent(item);
  return item;
}

/**
 * Saves the editor's changes. `status` "published" publishes (keeping the
 * first publication date when an item is published again), "draft" takes a
 * published item off the site, undefined leaves the status as it is.
 */
export async function updateContent(
  existing: ContentItem,
  input: ContentInput,
  status: "published" | "draft" | undefined,
  userId: string,
): Promise<ContentItem> {
  const { data, error } = await createAdminClient()
    .from("content_items")
    .update({
      ...columnsFor(input),
      ...(status ? { status } : {}),
      ...(status === "published" && !existing.publishedAt ? { published_at: new Date().toISOString() } : {}),
      updated_by: userId,
    })
    .eq("id", existing.id)
    .select(PAGE_COLUMNS)
    .single();
  if (error) throw toStoreError(error);
  const item = rowToItem(data as unknown as ContentRow);
  revalidateContent(item, existing);
  return item;
}

/**
 * Rebuilds the pages an item appears on (its hub, its own page, the sitemap) in every language - and its old
 * address if the slug changed. A published item is translated into the other languages in the background
 * (lib/translate/content.ts), so the translated pages are ready before the first reader asks for them.
 */
function revalidateContent(item: ContentItem, before?: ContentItem) {
  const pagesOf = (it: Pick<ContentItem, "type" | "slug">) =>
    LOCALE_CODES.flatMap((locale) => [getPathname({ locale, href: hubLink(it.type) }), getPathname({ locale, href: contentLink(it) })]);
  for (const path of pagesOf(item)) revalidatePath(path);
  if (before && (before.slug !== item.slug || before.type !== item.type)) {
    for (const path of pagesOf(before)) revalidatePath(path);
  }
  revalidatePath("/sitemap.xml");
  if (item.status === "published") after(() => translateOnPublish(item));
}

/** Deletes a draft for good. Published items are taken off the site first (unpublish), so nothing live disappears by mistake. */
export async function deleteDraft(existing: ContentItem): Promise<void> {
  if (existing.status !== "draft") throw new ContentStoreError("not_draft", "Avpublicera innan du tar bort.");
  const { error } = await createAdminClient().from("content_items").delete().eq("id", existing.id).eq("status", "draft");
  if (error) throw toStoreError(error);
  revalidateContent(existing);
}
