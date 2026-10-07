import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { FRAME_AREAS, loadMessages, pickMessages } from "./messages";
import type { Messages } from "./messages/types";
import type { AppLocale } from "./locales";

/**
 * Hands a page's texts to the client components below it. Server components read the texts themselves
 * (getTranslations); a client component (one that starts with "use client") needs them sent to the
 * browser, and only the areas it uses should be sent. Wrap a page's client components like this:
 *
 *   <ClientMessages areas={["landing", "faq"]}> ...client components... </ClientMessages>
 *
 * The areas of the page frame (the header, the chat, ...) are always included.
 */
export async function ClientMessages({ areas, children }: { areas: readonly (keyof Messages)[]; children: React.ReactNode }) {
  const locale = (await getLocale()) as AppLocale;
  const messages = await loadMessages(locale);
  return (
    <NextIntlClientProvider locale={locale} messages={pickMessages(messages, [...FRAME_AREAS, ...areas])}>
      {children}
    </NextIntlClientProvider>
  );
}
