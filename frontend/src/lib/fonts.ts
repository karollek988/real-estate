import { Caveat } from "next/font/google";
import localFont from "next/font/local";

/**
 * Display serif for the landing page headlines. It is the same self-hosted
 * Source Serif 4 the report already ships (app/[locale]/report/fonts), so the redesign
 * adds no new font file and fetches nothing from a font CDN. The file is the
 * variable font (weights 200-900); the report declares only 400-700.
 */
export const displaySerif = localFont({
  src: [{ path: "../app/[locale]/report/fonts/SourceSerif4-normal.woff2", weight: "200 900", style: "normal" }],
  variable: "--font-serif-display",
  display: "swap",
});

/**
 * Handwriting for the short margin notes on Bostadsguiden (Tailwind
 * font-hand). next/font downloads it at build time and serves it from the
 * site itself, like Inter - nothing is fetched from Google by the visitor.
 * Only the pages that put `handwriting.variable` on a wrapper load it.
 */
export const handwriting = Caveat({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-hand",
  display: "swap",
});
