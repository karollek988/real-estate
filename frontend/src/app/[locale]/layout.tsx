import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.scss";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ChatWidget } from "@/components/ChatWidget";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { CookieSettingsLink } from "@/components/CookieSettingsLink";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { SourceTracker } from "@/components/analytics/SourceTracker";
import { ScrollRestorationReset } from "@/components/ScrollRestorationReset";
import { SiteFooter } from "@/components/SiteFooter";
import { LOCALES } from "@/i18n/locales";
import { FRAME_AREAS, pickMessages } from "@/i18n/messages";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/i18n/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/** One static copy of every page per language. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    // Pages set their own title ("Priser") and get " | Köpanalys" appended.
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
    openGraph: { type: "website", locale: LOCALES[locale].ogLocale, siteName: "Köpanalys" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Without this a page is rendered per request instead of once at build time.
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={LOCALES[locale].htmlLang}>
      {/* Browser extensions (Grammarly, password managers) add attributes to <body> before React hydrates.
          suppressHydrationWarning covers this element's own attributes only, not its children. */}
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={pickMessages(messages, FRAME_AREAS)}>
          <AuthProvider>
            <ScrollRestorationReset />
            <PageViewTracker />
            <SourceTracker />
            {children}
            <SiteFooter />
            <CookieConsentBanner />
            <CookieSettingsLink />
            <ChatWidget />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
