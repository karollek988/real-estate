/**
 * The brand colours written out for e-mail. An e-mail client cannot read the stylesheet's variables, so each value is a
 * copy of its master variable in styles/_variables.scss (the key is the variable's name). colours.verify.mjs compares
 * every one with the stylesheet, so a brand colour that changes there and not here fails the checks.
 */
export const EMAIL_COLOURS = {
  white: "#ffffff",
  "ka-cream": "#f8f5f1",
  "ka-paper": "#fcfbf7",
  "ka-line": "#e3ded3",
  "ka-ink": "#0f1f18",
  "ka-text": "#1f2622",
  "ka-muted": "#5b625d",
  "ka-green-950": "#0c2a1f",
  "ka-green-900": "#163c2d",
  "ka-green-700": "#155a3c",
} as const;
