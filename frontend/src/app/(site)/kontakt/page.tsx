import type { Metadata } from "next";
import { ContactSection } from "@/components/sections/ContactSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { ROUTES } from "@/components/site/navigation";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Har du en fråga om Köpanalys eller din analys? Skicka ett meddelande eller mejla kontakt@kopanalys.se.",
  alternates: { canonical: ROUTES.kontakt },
};

/** The contact form first, then the answers to what most people ask. */
export default function KontaktPage() {
  return (
    <>
      <div className="pt-4">
        <ContactSection titleAs="h1" title="Kontakta oss" />
      </div>
      <FaqSection contactHref="#kontakt" />
    </>
  );
}
