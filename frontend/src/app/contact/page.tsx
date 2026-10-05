import { redirect } from "next/navigation";
import { ROUTES } from "@/components/site/navigation";

/** The old English address; the contact page is /kontakt. */
export default function ContactPage() {
  redirect(ROUTES.kontakt);
}
