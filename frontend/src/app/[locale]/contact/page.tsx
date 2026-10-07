import { redirect } from "@/i18n/navigation";
import { pageLocale, type LocaleParams } from "@/i18n/page";
import { ROUTES } from "@/components/site/navigation";

/**
 * The old English address of the Swedish site (kopanalys.se/contact); the contact page is /kontakt.
 * (/en/contact is the English contact page itself and is handled before it gets here.)
 */
export default async function ContactPage({ params }: LocaleParams) {
  const locale = await pageLocale(params);
  redirect({ href: ROUTES.kontakt, locale });
}
