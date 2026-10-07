import { ClientMessages } from "@/i18n/ClientMessages";

/** The waiting page is a client component; its stage texts get loaded here. */
export default function AnalyzingLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages areas={["analyzing"]}>{children}</ClientMessages>;
}
