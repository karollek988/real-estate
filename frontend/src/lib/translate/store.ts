import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What has been translated already (supabase/migrations/20261008120000_text_translations.sql): one row per text and
 * language, found by a fingerprint of the Swedish text. In front of the table sits a small cache in this server
 * process, so the pages of one rebuild do not ask the database for the same sentence twice. Server-only.
 * A database that cannot be reached is not an error: it just means nothing is remembered.
 */

export function hashText(source: string, text: string): string {
  return createHash("sha256").update(`${source}\n${text}`).digest("hex");
}

const MEMORY_LIMIT = 4000;
const memory = new Map<string, string>();

function remember(key: string, value: string) {
  if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value as string);
  memory.set(key, value);
}

const key = (target: string, hash: string) => `${target}:${hash}`;

/** The stored translations of these fingerprints, by fingerprint. */
export async function findTranslations(hashes: string[], target: string): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const missing: string[] = [];
  for (const hash of hashes) {
    const hit = memory.get(key(target, hash));
    if (hit !== undefined) found.set(hash, hit);
    else missing.push(hash);
  }
  if (missing.length === 0) return found;

  try {
    const admin = createAdminClient();
    // in slices: the fingerprints go into the address of the request
    for (let i = 0; i < missing.length; i += 80) {
      const { data, error } = await admin
        .from("text_translations")
        .select("source_hash, translated_text")
        .eq("target_language", target)
        .in("source_hash", missing.slice(i, i + 80));
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as Array<{ source_hash: string; translated_text: string }>) {
        found.set(row.source_hash, row.translated_text);
        remember(key(target, row.source_hash), row.translated_text);
      }
    }
  } catch (err) {
    console.warn("[translate] stored translations could not be read:", err instanceof Error ? err.message : err);
  }
  return found;
}

export interface NewTranslation {
  hash: string;
  source: string;
  sourceText: string;
  target: string;
  translated: string;
  engine: string;
}

/** Remembers new translations (in this process at once, in the database as well when it can be reached). */
export async function saveTranslations(rows: NewTranslation[]): Promise<void> {
  if (rows.length === 0) return;
  for (const row of rows) remember(key(row.target, row.hash), row.translated);
  try {
    const { error } = await createAdminClient()
      .from("text_translations")
      .upsert(
        rows.map((row) => ({
          source_hash: row.hash,
          target_language: row.target,
          source_language: row.source,
          engine: row.engine,
          source_text: row.sourceText.slice(0, 20000),
          translated_text: row.translated.slice(0, 40000),
        })),
        { onConflict: "source_hash,target_language", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn("[translate] translations could not be stored:", err instanceof Error ? err.message : err);
  }
}
