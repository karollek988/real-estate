import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.scss";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ChatWidget } from "@/components/ChatWidget";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { CookieSettingsLink } from "@/components/CookieSettingsLink";
import { ScrollRestorationReset } from "@/components/ScrollRestorationReset";
import { SiteFooter } from "@/components/SiteFooter";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kopanalys.se";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Pages set their own title ("Priser") and get " | Köpanalys" appended.
  title: {
    default: "Köpanalys – vi visar vad du faktiskt köper",
    template: "%s | Köpanalys",
  },
  description:
    "En oberoende granskning av bostaden du vill köpa: föreningens ekonomi, området och alla kostnader. Områdesanalys 99 kr, Trygghetspaketet 499 kr.",
  openGraph: {
    type: "website",
    locale: "sv_SE",
    siteName: "Köpanalys",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      {/* Browser extensions (Grammarly, password managers) add attributes to <body> before React hydrates.
          suppressHydrationWarning covers this element's own attributes only, not its children. */}
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <ScrollRestorationReset />
          {children}
          <SiteFooter />
          <CookieConsentBanner />
          <CookieSettingsLink />
          <ChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
