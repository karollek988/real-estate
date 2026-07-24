# Task 010 — Real Terms of Service and Privacy Policy pages

Read `deepseek-tasks/GROUND_RULES.md` first and follow it.

## Context

`frontend/src/components/AuthModal.tsx` (around lines 364-379) already has a signup
checkbox referencing "villkoren" (terms) and "integritetspolicyn" (privacy policy), but
both links are placeholder `href="#"` — **neither page exists**. This task creates both
pages for real and wires up the existing links.

Company/data-controller identity to use throughout both documents:
- Company name: **Köpanalys**
- Org. nr: **9811048793**
- Contact email: **contact@kopanalys.se**

**Important — this is real legal content, not filler text:**
- Do not write a clause claiming the company can never be sued for anything under any
  circumstance — that kind of absolute blanket immunity is typically unenforceable under
  Swedish/EU consumer protection law anyway (you cannot fully disclaim liability for
  gross negligence or wilful misconduct, or void statutory consumer rights). Phrase all
  liability-limiting language with qualifiers like "i den utsträckning som tillåts enligt
  gällande lag" (to the extent permitted by applicable law) rather than absolute claims.
- Your final summary must include an explicit note that this is placeholder-grade legal
  text and a human should have an actual lawyer review it before relying on it in a real
  dispute — you are not a lawyer and neither is the human running this task.

## Goal

### 1. `frontend/src/app/terms/page.tsx` — Terms of Service ("Villkor")

A normal Next.js page (Swedish content, matching the site's existing tone/typography —
look at how `frontend/src/app/page.tsx` or `frontend/src/app/dashboard/*` structure
headings/prose for visual consistency, e.g. reuse `Source_Serif_4`/heading patterns if
already used for long-form content elsewhere, otherwise plain clean typography is fine).

Sections, in order:
1. Tjänstebeskrivning — Köpanalys är ett automatiserat analysverktyg som sammanställer
   offentlig och tredjepartsdata om bostäder; det är **inte** finansiell rådgivning eller
   en köprekommendation (this must be consistent with the product's existing
   non-advisory positioning — see the system prompt in
   `analysis_engine/narrator/openai_provider.py` for the established tone: Köpanalys
   never gives verdicts or recommendations, only reports what the data shows).
2. Konto och användning — account responsibilities, accurate information, one account
   per person, no abuse/scraping of the service.
3. Analyser och krediter — free (3) / Premium quota system, Premium purchases via Stripe
   are final once the report is unlocked/delivered (standard digital-goods no-refund-
   after-delivery language, still subject to Swedish consumer law's 14-day distance
   contract cooling-off rules where applicable — phrase carefully, don't claim an
   absolute no-refund policy that overrides statutory rights).
4. Immateriella rättigheter — Köpanalys owns the platform/report format; the user gets a
   personal-use license to the specific report they purchased.
5. Uppsägning — Köpanalys may suspend/terminate accounts that violate these terms.
6. Tillämplig lag — Swedish law, disputes in Swedish courts (Allmänna reklamationsnämnden
   / ARN for consumer disputes, per standard Swedish practice).
7. Kontakt — contact@kopanalys.se.
8. **Last item, styled as a footnote** (smaller/secondary text size than the rest of the
   page's body copy — e.g. `text-xs text-neutral-500` or whatever this codebase's
   existing secondary-text convention is, check other components for the pattern rather
   than inventing one): the liability disclaimer. Content: reports are generated from
   automated analysis of public and third-party data sources; Köpanalys does not
   guarantee completeness or accuracy of underlying data it does not itself produce;
   the report is not a substitute for independent due diligence, a professional
   besiktning (inspection), or licensed financial/legal advice before a property
   purchase; to the extent permitted by applicable law, Köpanalys is not liable for
   decisions made in reliance on a report or for losses arising from inaccuracies in
   third-party source data. Keep it in the same numbered/ordered list as the other
   sections (per the human's explicit request: last item in the list, smaller text —
   not hidden in a separate collapsed/hidden element, not removed from the visible page).

### 2. `frontend/src/app/privacy/page.tsx` — Privacy Policy ("Integritetspolicy")

Sections:
1. Personuppgiftsansvarig — Köpanalys, org.nr 9811048793, contact@kopanalys.se.
2. Vilka uppgifter vi samlar in — split clearly into two categories matching task 009's
   cookie banner:
   - **Nödvändiga** (always collected, no consent required): auth session data (handled
     by Supabase), account profile data (email, name if provided), data required to
     generate and store the property analyses the user requests.
   - **Marknadsföring & analys** (optional, requires consent via the cookie banner):
     usage analytics and marketing/lead-tracking data — describe this as being used for
     Köpanalys's own marketing and product-improvement purposes (per the human's
     clarification: this is in-house marketing/analytics use, not sale of data to third
     parties — do not write language implying data is sold to external buyers).
   - Explicitly note that until the visitor makes a choice in the cookie banner, and
     unless they choose "Acceptera alla", no data in the marketing/analytics category is
     collected.
3. Rättslig grund — necessary data: performance of contract (delivering the service the
   user signed up for); marketing/analytics data: consent (Art. 6(1)(a) GDPR).
4. Tredje parter / mottagare — name the actual processors this codebase uses: Supabase
   (hosting/auth/database), Stripe (payments). Describe them as data processors acting on
   Köpanalys's instructions, not as parties Köpanalys sells data to.
5. Lagringstid — a reasonable stated retention period (e.g. account data kept while the
   account is active plus a reasonable period after deletion for legal/accounting
   purposes; analytics data per a stated retention window, e.g. 12-24 months).
6. Dina rättigheter — access, rectification, erasure, objection to marketing processing,
   data portability, and the right to complain to IMY (Integritetsskyddsmyndigheten, the
   Swedish supervisory authority) — name it explicitly.
7. Hur du återkallar samtycke — note that declining or later withdrawing
   marketing/analytics consent stops that category of collection; explain how (re-clear
   the cookie banner's stored decision or contact contact@kopanalys.se).
8. Kontakt — contact@kopanalys.se.

### 3. Wire up the existing links

In `frontend/src/components/AuthModal.tsx`, change the two `href="#"` occurrences (around
lines 366-370 and 373-377) to `href="/terms"` and `href="/privacy"` respectively.

## Definition of done

- Both pages exist as real Next.js routes with the content described above.
- The liability disclaimer is the last item in the Terms page's list, in visibly smaller
  (but not hidden/removed) text than the rest of that page's body copy.
- `AuthModal.tsx`'s two placeholder links now point to the real pages.
- `npm run build` passes in `frontend/`.
- Final summary must include the "have an actual lawyer review this" note described
  above, plus confirm no clause claims absolute/unconditional immunity from all legal
  claims.
