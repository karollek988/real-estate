/**
 * THE SWEDISH TEXTS: THE MASTER COPY OF EVERY TEXT ON THE SITE.
 *
 * One file per area of the site. Each area is a top-level key here, and a component asks for it by name:
 * useTranslations("landing") in a component, getTranslations("landing") in a page.
 * See src/i18n/README.md for how to add a language.
 */
import analyzing from "./analyzing";
import apiErrors from "./apiErrors";
import auth from "./auth";
import balance from "./balance";
import brf from "./brf";
import buy from "./buy";
import chat from "./chat";
import common from "./common";
import consent from "./consent";
import dashboard from "./dashboard";
import emails from "./emails";
import exampleReport from "./exampleReport";
import faq from "./faq";
import footer from "./footer";
import forms from "./forms";
import insights from "./insights";
import inspection from "./inspection";
import kunskap from "./kunskap";
import landing from "./landing";
import legal from "./legal";
import map from "./map";
import meta from "./meta";
import nav from "./nav";
import notFound from "./notFound";
import onboarding from "./onboarding";
import packages from "./packages";
import pages from "./pages";
import pricing from "./pricing";
import report from "./report";
import sections from "./sections";

const messages = {
  analyzing,
  apiErrors,
  auth,
  balance,
  brf,
  buy,
  chat,
  common,
  consent,
  dashboard,
  emails,
  exampleReport,
  faq,
  footer,
  forms,
  insights,
  inspection,
  kunskap,
  landing,
  legal,
  map,
  meta,
  nav,
  notFound,
  onboarding,
  packages,
  pages,
  pricing,
  report,
  sections,
};

export default messages;
