import localFont from "next/font/local";

/**
 * Display serif for the landing page headlines. It is the same self-hosted
 * Source Serif 4 the report already ships (app/report/fonts), so the redesign
 * adds no new font file and fetches nothing from a font CDN. The file is the
 * variable font (weights 200-900); the report declares only 400-700.
 */
export const displaySerif = localFont({
  src: [{ path: "../app/report/fonts/SourceSerif4-normal.woff2", weight: "200 900", style: "normal" }],
  variable: "--font-serif-display",
  display: "swap",
});
