import type { User } from "@supabase/supabase-js";
import type { AppLocale } from "@/i18n/locales";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Keeps the language an account's e-mails are written in (user_metadata.locale, set when the account is created)
 * in step with the language the customer actually uses: called when they order an analysis, with the language of
 * the page they ordered from. Best effort: it never fails the request that called it.
 */
export async function rememberCustomerLanguage(user: Pick<User, "id" | "user_metadata">, locale: AppLocale): Promise<void> {
  if (user.user_metadata?.locale === locale) return;
  try {
    const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, locale },
    });
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error(`rememberCustomerLanguage failed for user ${user.id}:`, err);
  }
}
