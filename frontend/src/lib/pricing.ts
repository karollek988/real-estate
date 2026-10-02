// Prices in SEK including VAT. Each one-time package maps to a Stripe Price in
// lib/stripe/prices.ts — change an amount here AND create a new Stripe Price
// for it (a Stripe Price's amount can't be edited).
export const OMRADESANALYS_PRICE_SEK = 99;

export const TRYGGHETSPAKET_PRICE_SEK = 499;

export const TRE_BOSTADER_PRICE_SEK = 999;
export const TRE_BOSTADER_COUNT = 3;

// Reference point shown next to the Trygghetspaket: Anticimex's price for a
// villa inspection, 2026. Cite the source wherever this is displayed.
export const HUSBESIKTNING_REFERENCE_PRICE_SEK = 10_000;

// Fixed formatting instead of toLocaleString: the same string on the server
// and in the browser, so a page can't hydrate with a mismatched separator.
export const formatSek = (amount: number) => String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
