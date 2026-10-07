import type { ReactNode } from "react";

/**
 * The tags the legal texts (src/i18n/messages/<language>/legal.ts) use, and what each one becomes on the page.
 * Pass it to `t.rich("privacy.controller.text", legalRich)`.
 */

const LINK_CLASS = "text-green-400 underline underline-offset-4 transition hover:text-green-300";

/** The address people write to about the legal texts. */
export const LEGAL_EMAIL = "kontakt@kopanalys.se";

export const legalRich = {
  mail: () => (
    <a href={`mailto:${LEGAL_EMAIL}`} className={LINK_CLASS}>
      {LEGAL_EMAIL}
    </a>
  ),
  b: (chunks: ReactNode) => <strong>{chunks}</strong>,
  code: (chunks: ReactNode) => <code>{chunks}</code>,
  imy: (chunks: ReactNode) => (
    <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {chunks}
    </a>
  ),
  br: () => <br />,
};
