import { ClientMessages } from "@/i18n/ClientMessages";

/** The report is built on the server; its few client parts (the upload box, the update button) get their texts here. */
export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return <ClientMessages areas={["report", "brf"]}>{children}</ClientMessages>;
}
