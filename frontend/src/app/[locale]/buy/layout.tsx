import { ClientMessages } from "@/i18n/ClientMessages";

/** The store page is one client component: its texts (and the packages') are sent to the browser here. */
export default function BuyLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages areas={["buy", "packages", "balance"]}>{children}</ClientMessages>;
}
