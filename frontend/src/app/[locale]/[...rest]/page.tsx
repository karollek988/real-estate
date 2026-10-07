import { notFound } from "next/navigation";

/**
 * Catches every address that is not a page, so the "page not found" screen is shown inside the language
 * folder - in the visitor's language, with the site's own header - and not as the bare fallback.
 */
export default function CatchAll() {
  notFound();
}
