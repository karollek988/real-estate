# User Input Flow

**Date:** 2026-07-15 · **Milestone:** 1 (Build Phase) · **Status:** UX/flow design only — no business logic, no analysis engine, no APIs

## Purpose

This document designs the complete user journey from landing on the
homepage to having all required property information collected and
confirmed, ready to hand off to the (not-yet-built) analysis engine. It
covers both supported input methods, every provider, and every failure
mode we can anticipate. Nothing here implements scoring, valuation, or
report generation — see [[12_user_journey]] for how the *output*
experience should feel and [[18_report_inputs]] for what data the engine
will eventually need. This document is strictly about getting from zero
to a validated, complete property record.

---

## 1. Complete user flow

### 1.1 Landing

The homepage shows exactly one primary input: a single text field with
placeholder text like *"Paste a listing link, or enter an address"* and
a secondary, quieter link/button: *"Don't have a link? Enter details
manually."*

There is no login wall, no account creation, no "before you begin"
friction — consistent with [[12_user_journey]]'s trust mechanics.

### 1.2 The one input field does double duty

The single field accepts either:

- a URL (any of the supported providers, or an unsupported/invalid one), or
- free-text (an address, partial address, or nonsense)

On submit, the system classifies the input (see §2 decision tree) and
routes accordingly. This avoids forcing the user to pre-declare "I have
a link" vs "I don't" — many users don't think in those terms, they just
paste what they have.

### 1.3 Happy path — supported URL

1. User pastes a Booli (or other supported provider) URL and submits.
2. System recognizes the provider, shows a lightweight loading state
   ("Reading listing…") with a skeleton preview card, not a blank
   spinner — reduces perceived wait.
3. Listing is parsed/resolved. A **confirmation card** appears showing
   what was found: address, thumbnail, living area, rooms, floor,
   asking price, BRF name if detected.
4. User reviews the card. Two actions: **"Looks right, continue"** or
   **"Something's wrong, edit details"**.
5. System silently checks for missing-but-required fields (see §3) and,
   if any are unresolvable automatically, appends a short **"just a few
   more details"** micro-form beneath the confirmation card — never a
   separate page, never resetting progress already made.
6. Once complete, user hits **"Analyze this property"**, which is the
   flow's single terminal action. From here, output/report behavior is
   out of scope for this document (see [[12_user_journey]]).

### 1.4 Happy path — Hemnet URL (special case)

Hemnet cannot be queried at all ([[data-source-inventory.md]] entry 2:
scraping and AI/ML use are explicitly banned). So a Hemnet URL is
*recognized* as a provider but cannot be *resolved* automatically.

1. User pastes a Hemnet URL.
2. System recognizes the domain, shows: *"We can't read Hemnet listings
   automatically — but we can still analyze this property. Enter the
   address below and we'll take it from there."*
3. This drops the user directly into the manual-entry flow (§1.5),
   pre-populated with nothing but framed as a continuation, not a
   restart or dead end — the user should never feel like pasting the
   Hemnet link was a wasted step.
4. Optionally (future improvement, not required for MVP): attempt an
   address-based cross-reference against Booli to auto-fill fields even
   though the entry point was Hemnet — see §7.

### 1.5 Happy path — manual entry

1. User clicks "Enter details manually" or lands here via a Hemnet URL
   or an address-only input that couldn't be geocoded to a single
   confident match.
2. Form opens with **address first**, as its own step — because address
   resolution unlocks auto-fill for everything else (see §4). As the
   user types, an autocomplete/geocoding suggestion list appears
   (powered by Lantmäteriet address data).
3. User selects their address from suggestions (or types a full address
   and confirms if no suggestion matches — see §5 "address not found").
4. System attempts automatic lookup for everything it can (§4). Fields
   it fills are shown as **pre-filled and visually marked "auto-filled
   — tap to edit"** rather than editable-looking blank inputs, so users
   understand they don't need to re-enter what's already correct, but
   can correct it if wrong.
5. Remaining required fields (§3) are presented as a short, single-page
   form — not a multi-step wizard — since the field count is small
   enough not to need pagination. Optional/"nice to have" fields are
   visually deprioritized (collapsed under "Add more details
   (optional)").
6. Same terminal action as §1.3: **"Analyze this property"**, enabled
   only once all *required* fields are present.

### 1.6 Returning users / repeat visits

Not a separate flow, but worth stating: because there's no login wall,
"returning" is detected by matching input (URL or address) against
prior analyses, not by session/account state. See §2.6 and §2.7 in the
decision tree.

---

## 2. Decision tree

```
User submits input
│
├─ Input is empty
│   └─ Inline validation: "Paste a link or enter an address to get started."
│       No page change, no submission attempt. (§5.1)
│
├─ Input is a URL
│   │
│   ├─ URL host matches a supported provider
│   │   │
│   │   ├─ Provider = Hemnet
│   │   │   └─ Route to §1.4 (cannot auto-resolve, hand off to manual entry)
│   │   │
│   │   └─ Provider = Booli / Boneo / Fastighetsbyrån / Svensk
│   │       Fastighetsförmedling / Bjurfors / HusmanHagberg / Notar
│   │       │
│   │       ├─ Listing resolves successfully
│   │       │   └─ Route to §1.3 confirmation card
│   │       │
│   │       ├─ Listing page returns 404 / listing removed or sold
│   │       │   └─ §5.6 "This listing is no longer available"
│   │       │
│   │       ├─ Listing resolves but is missing critical fields
│   │       │   (e.g. no floor, no BRF name detected)
│   │       │   └─ Route to §1.3 confirmation card + micro-form for gaps
│   │       │
│   │       └─ Provider's source is slow / times out
│   │           └─ §5.9 slow external service handling
│   │
│   ├─ URL host does not match any supported provider, but *looks like*
│   │   a real-estate listing (heuristic: contains words like "bostad",
│   │   "lägenhet", "till salu" or matches known-competitor patterns)
│   │   └─ §5.2 "We don't support this site yet" + manual-entry offer
│   │       + (internal, non-user-facing) log the domain for provider
│   │       prioritization — see §7
│   │
│   ├─ URL host is unrelated to real estate (e.g. YouTube, a news
│   │   article, a random link)
│   │   └─ §5.3 "This doesn't look like a property listing"
│   │       + manual-entry offer. Do not attempt to parse it.
│   │
│   └─ Input is not a well-formed URL despite containing "http"/"www"
│       (malformed/broken paste)
│       └─ §5.4 generic invalid-input message + manual-entry offer
│
└─ Input is not a URL (free text)
    │
    ├─ Text resolves to exactly one confident address match
    │   └─ Route to §1.5 step 4 (auto-fill), address pre-confirmed
    │
    ├─ Text resolves to multiple plausible address matches
    │   (e.g. "Storgatan 5" exists in several municipalities, or a
    │   building has multiple apartment numbers)
    │   └─ §5.5 disambiguation list — user picks the correct one.
    │       If the specific apartment/lägenhetsnummer can't be
    │       determined from the match, ask for it explicitly (§5.7)
    │
    ├─ Text does not resolve to any known address
    │   └─ §5.8 "We couldn't find that address" — offer manual entry
    │       with address field left as free text (user proceeds without
    │       geocoding confirmation, flagged internally as lower-
    │       confidence input)
    │
    └─ Text matches an address that has already been analyzed
        (cache hit)
        └─ §2.6 duplicate/cached handling
```

### Duplicate / cache branches (referenced above)

**§2.6 — Existing cached report for this exact address/unit**
Show a lightweight interstitial: *"We already have a recent analysis
for this address (checked 3 days ago). View it, or run a fresh
analysis?"* Two buttons, no forced choice — cached analyses may be
stale if the listing/BRF data changed, so refreshing must always remain
one click away, not gated.

**§2.7 — Same listing submitted twice in short succession (double
submit)**
Debounce/idempotency at the input level: if the exact same URL is
submitted again while the first request is still resolving, don't start
a second lookup — attach to the in-flight one.

---

## 3. Required user inputs

These are the fields the analysis engine needs (per [[18_report_inputs]])
that must be present, one way or another, before "Analyze this
property" is enabled:

| Field | Required? | Notes |
|---|---|---|
| Address | Required | Unlocks most auto-fill; see §4 |
| Living area (m²) | Required | Needed for comparable normalization |
| Number of rooms | Required | Comparable-filtering criterion |
| Monthly fee (avgift) | Required | Core BRF-cost input |
| Floor | Required | Comparable-filtering criterion |
| Building year | Required | Comparable-filtering + buyer-relevant fact |
| Property condition | Required | No public source; must be user-asserted |
| Asking price | Required (if evaluating a listing) | Not applicable to a pure "check this address" analysis, so only required when the flow started from a listing/bid context |
| Balcony (yes/no) | Optional | Nice-to-have differentiator, not blocking |
| Elevator (yes/no) | Optional | Often inferable from building age/floor count, but not reliably enough to assume |
| Parking | Optional | Frequently absent from listing data entirely |
| BRF name / registration | Auto-resolved where possible | Needed for Bolagsverket lookup; user should never be asked to type a BRF org.number directly |
| Free-text "anything else important" | Optional | Catch-all for renovations, disputes, known issues, etc. |

Design rule: **never ask for something we can plausibly derive.** If a
field can't be derived with high confidence, ask for it once, briefly,
inline — don't build a long form up front on the assumption it might be
needed.

---

## 4. Automatic data collection opportunities

Once an address is confirmed (whether via URL resolution or manual
geocoding), the system should attempt to auto-fill as much as possible
before asking the user anything. Mapped against
[[data-source-inventory.md]]:

| Field | Auto-fill source | Confidence |
|---|---|---|
| Address (canonical form), coordinates | Lantmäteriet open geodata | High |
| Living area, rooms, floor, building year, asking price | Booli (if listing resolvable) | High |
| BRF name → BRF registration number match | Booli listing attributes → Bolagsverket registry lookup | **Unconfirmed mechanism** — per [[18_report_inputs]], this matching step is not yet a solved lookup. Until solved, treat as a manual-confirm step: show the best-guess BRF match and let the user confirm/correct rather than silently trusting it. |
| BRF debt, fees, reserves (for later report sections, not this flow) | Bolagsverket filings | High, once BRF match is confirmed |
| Area price trend context | SCB / Svensk Mäklarstatistik aggregates | Medium (aggregate-level only, informs later report, not this flow) |
| Nearby transit / planned infrastructure | Trafiklab, Region Stockholm | Medium — used downstream in reports, not required at input time |

**Never auto-fill:** property condition. This is inherently subjective
and has no reliable public source — always ask.

**Auto-fill failure handling:** if a source lookup fails or times out
for a non-critical auto-fill field (e.g. elevator/parking), don't block
the flow — silently fall back to asking the user, or leave it in the
optional/collapsed section. Only *required* fields that fail to
auto-fill should surface as an explicit ask.

---

## 5. Error handling

Each error state maps to a specific, honest, non-technical message and
always offers a path forward — never a dead end.

**5.1 Empty input** — inline validation only, no page transition:
*"Paste a link or enter an address to get started."*

**5.2 Unsupported provider (recognizable real-estate site, not yet
integrated)** —
*"We don't support [domain] yet, but you can still analyze this
property — enter the details manually (takes about a minute)."*
Internally log the domain (aggregated, not per-user) to inform which
provider to add next — see §7.

**5.3 Non-property URL (e.g. YouTube link)** —
*"That doesn't look like a property listing. If you have an address
instead, you can enter it directly."* Tone should be neutral, not
scolding — this will happen from accidental pastes, not malicious
input.

**5.4 Malformed/invalid URL** —
*"We couldn't read that link. Double check it's a full listing URL, or
enter the address directly."*

**5.5 Address disambiguation (multiple matches)** —
Present a short list (address + municipality +, if available, thumbnail
from a resolvable listing at that address) and let the user pick. If
none match, offer "None of these — enter manually."

**5.6 Listing no longer available (404/removed/sold)** —
*"This listing isn't available anymore — it may have been sold or
removed. You can still analyze the property by address."* Pre-fill
whatever was cached from a prior successful crawl of that URL, if any,
rather than starting from zero.

**5.7 Missing apartment/unit number** —
When an address resolves to a building with multiple units and the
specific unit can't be determined (from URL or geocoding), explicitly
ask: *"Which apartment? (e.g. floor + door number, or 'lgh 1201')"*
rather than silently guessing or proceeding with ambiguous data — BRF
and floor-specific comparables depend on getting this right.

**5.8 Address not found at all** —
*"We couldn't find that address. You can still continue — just double
check the spelling, or enter details manually."* Never hard-block; a
user's typed address (even if ungeocoded) is still usable as free text
downstream, flagged as lower-confidence.

**5.9 Slow external service (Booli/Lantmäteriet/Bolagsverket lookup
taking too long)** —
Show a progressive loading state: after ~2s "Reading listing details…",
after ~6s "This is taking longer than usual…", after ~12s offer a
bail-out: *"Still working — you can wait, or enter the details
manually while we keep trying in the background."* Never let a slow
dependency block the user from making progress a different way.

**5.10 Partial resolution (some fields found, some not)** — not
strictly an error: treat as the default case, not an exception. Route
through §1.3 with the micro-form appended, as already described. This
is listed here only to make explicit that "partial success" is a first-
class, expected state, not a fallback path bolted on afterward.

**5.11 Duplicate submission** — see §2.6/§2.7 above.

---

## 6. UX recommendations

- **One field to start, always.** Never force the user to choose
  "link" vs "manual" before they've typed anything — classify on
  submit.
- **Progress is never lost.** Every error/edge-case path (unsupported
  provider, Hemnet, address-not-found) leads *into* manual entry with
  whatever was already gathered preserved, never a reset to a blank
  form.
- **Show what we found before asking for more.** The confirmation card
  pattern (§1.3) builds trust and lets the user catch a wrong match
  early, before investing effort in a form — same "verify, don't just
  trust" principle as [[12_user_journey]] applies to the analysis
  output.
- **Distinguish auto-filled from user-entered visually**, so users
  understand what they can skip reviewing vs what they must provide.
- **Required vs optional fields are visually distinct**, with optional
  fields collapsed by default to keep the perceived form short.
- **No technical error language.** Never surface HTTP status codes,
  provider names as "the API," or stack-trace-flavored text to the
  user.
- **The "Analyze this property" action is the only terminal action** —
  no intermediate "save progress" or "submit form" steps that could
  read as more commitment than they are.
- **Match the loading-state pacing to real latency** — Bolagsverket/
  Booli lookups are not instant; design the waiting experience (§5.9)
  rather than treating it as an edge case.

---

## 7. Future improvements

- **Hemnet cross-reference matching**: attempt to resolve a pasted
  Hemnet URL to the equivalent Booli record by address, so Hemnet
  entry-points can eventually get the same auto-fill quality as direct
  Booli links, without ever scraping Hemnet itself.
- **Browser extension / bookmarklet**: capture the listing at the
  moment the user is browsing a provider site, removing the copy-paste
  step entirely.
- **Provider expansion pipeline**: turn the §5.2 unsupported-domain log
  into a ranked backlog, and formalize what "adding a provider" requires
  (a config entry mapping selectors/API fields, not new flow logic) —
  this document's flow should not need to change as providers are
  added, only the provider registry behind it.
- **BRF-name-to-registration-number matching**: once solved (per the
  open gap noted in [[18_report_inputs]]), this becomes a silent
  auto-fill instead of a user-facing confirm step, further shortening
  the manual-entry path.
- **Confidence-aware address entry**: if a user proceeds with an
  ungeocoded free-text address (§5.8), surface that lower confidence
  later in the report rather than only at input time.
- **Saved/returning-user context** (post-login, if accounts are ever
  introduced): "you've looked at 4 objects in this building" per
  [[12_user_journey]]'s later-journey section — explicitly out of scope
  for this milestone, which assumes no login.
