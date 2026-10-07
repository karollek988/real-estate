/**
 * THE ENGLISH TEXTS.
 *
 * The same files and keys as the Swedish ones in ../sv; only the values are translated. Typed as the
 * complete set of Swedish keys, so TypeScript reports a text that is missing here. (A language that is
 * only partly translated can use DeepPartial<Messages> instead: what is missing is shown in Swedish.)
 *
 * TERMINOLOGY, so that the same Swedish word has the same English word on every page (British English):
 *   bostadsrätt = tenant-owned flat      bostadsrättsförening / BRF = housing association (BRF)
 *   månadsavgift = monthly fee           årsredovisning = annual report
 *   mäklare = estate agent               visning = viewing            budgivning = bidding
 *   kontantinsats = deposit              lagfart = title registration (lagfart)
 *   underhållsplan = maintenance plan    bostadsanalys = home analysis
 *   Trygghetspaket = Peace of Mind Package    Områdesanalys = Area analysis
 * Köpanalys is the brand and is never translated. Prices stay in SEK; Swedish place names stay as they are.
 */
import type { Messages } from "../types";
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

const messages: Messages = {
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
