# 35 — BRF Website Discovery: Source Research

Status: **Research only — no code.** Findings from live investigation (WebSearch/WebFetch), 2026-07-19/20.

## 1. Purpose

Before implementing the self-growing BRF Registry (`docs/34_brf_registry_architecture.md`), this report surveys every realistic source for resolving a Swedish BRF (bostadsrättsförening) to its **official website**, so annual reports can be crawled from that site. For each source: does it expose the website, is there an API, can it be scraped, auth requirements, rate limits, legal restrictions, reliability (1-10), and estimated coverage (% of Sweden's ~30,000-45,000 BRFs).

**Headline finding**: of 17 originally-scoped sources plus 3 discovered during research, only **4** directly expose BRF→website mappings usable for automated resolution: **allabrf.se** (already integrated), **HSB** (partial, per-region), and two newly-discovered sources, **Hittabrf.se** (paid) and **SvenskBrf.se** (free). Every dedicated property-manager SaaS provider (SBC, Riksbyggen, Nabo, Fastum, MBF, Simpleko, Bredablick) keeps this data behind a login-gated customer portal with no public directory.

## 2. Registries, Lookup Sites & Listing Portals

### 2.1 Bolagsverket (bolagsverket.se) — official companies registry

| Question | Answer |
|---|---|
| Exposes website? | No — BRF registration records carry no website field. |
| API? | Yes, official (`bolagsverket.se/apierochoppnadata`) for org identity data; most operations require a signed agreement + fee. BRFs cannot yet submit annual reports via API. |
| Scrapeable? | Web UI is CAPTCHA/audio-challenge protected on lookup; the API is the intended access path. |
| Auth? | API requires credentials/agreement. |
| Rate limits? | Governed by agreement terms; not publicly documented. |
| Legal | Public register data, reuse generally permitted; GDPR applies to any board-member personal data returned. |
| Reliability | 10/10 for identity/org-number ground truth; N/A for website (doesn't have one). |
| Coverage | ~100% of BRFs have an org number here; 0% website coverage. |

**Verdict: dead end for website resolution.** Retain only as the authoritative org-number/identity cross-check (`REGISTRY_AUTHORITY` tier in the registry design).

### 2.2 Allabolag.se

| Question | Answer |
|---|---|
| Exposes website? | No website field found on BRF profiles. |
| API? | None public. |
| Scrapeable? | robots.txt explicitly disallows `/sök?`, `/uppgifter/`, `/statistik/`, `/bokslut/`, `/@*` — blocking the exact paths that would carry BRF detail data. |
| Auth? | Some data paywalled. |
| Rate limits? | Implied by the extensive disallow list — active anti-scraping posture. |
| Legal | robots.txt blocks the relevant paths; GDPR applies to officer names shown. |
| Reliability | 8/10 for financial data generally; N/A for website (not exposed). |
| Coverage | ~90-100% of BRFs have a profile page; 0% expose a website field. |

**Verdict: dead end.**

### 2.3 Hitta.se

| Question | Answer |
|---|---|
| Exposes website? | Official API is map/routing/satellite-imagery focused, not a company-website field; consumer site may show "hemsida" for generic businesses but this is unconfirmed for BRF entities specifically. |
| API? | Yes, paid (0.03-0.25 SEK/request, 600 SEK/month minimum) — wrong data domain for this use case regardless. |
| Scrapeable? | Not deeply assessed — low expected value given the API mismatch. |
| Auth? | API requires signup/key. |
| Rate limits? | Governed by paid tier. |
| Legal | Not assessed in depth. |
| Reliability | Unknown/low for this specific use case. |
| Coverage | Unknown. |

**Verdict: dead end** — wrong data domain (location/mapping, not company websites).

### 2.4 allabrf.se — already integrated (`AllabrfProvider`)

| Question | Answer |
|---|---|
| Exposes website? | **Yes, confirmed.** Profile pages carry an explicit "Länk till föreningens hemsida" field. |
| API? | Advertises a paid/contractual integration API for banks/energy sector. Separately, public unauthenticated endpoints are already in production use: `GET /items/names?query=<q>` (autocomplete) and `GET /<slug>` (profile incl. website) and `GET /<slug>/dokument` (documents). |
| Scrapeable? | Plain HTTP/HTML; `AllabrfProvider` only escalates to a browser (Camoufox) fallback on 403/429/challenge, i.e. normal operation is scrapeable without one. |
| Auth? | Metadata/website field is public; some individual documents sit behind `/users/authentication/login`. |
| Rate limits? | Not fully characterized; soft blocking is possible but not observed as a hard wall in current usage. |
| Legal | robots.txt disallows only the `/api` prefix; the endpoints in active use sit outside it (verified live 2026-07-18 per the existing provider's docstring). GDPR applies to any board contact data collected. |
| Reliability | 8/10 — purpose-built BRF database; self-reported ~5,000 associations actively updated per month. |
| Coverage | Self-reported ~25,000 BRFs indexed (roughly 55-80% of the estimated 30-45k total), but freshness varies since only a subset gets active monthly updates. |

**Verdict: the strongest already-validated source.** Confirms the current architecture's choice to make it the `DIRECTORY`-tier default.

### 2.5 Hemnet.se — already integrated (identity entry point only)

| Question | Answer |
|---|---|
| Exposes website? | No — by design. Listings give address and (sometimes) BRF name via the embedded Next.js/Apollo JSON, never the BRF's own website. |
| API? | None public; current integration parses `__NEXT_DATA__` JSON with an HTML fallback. |
| Scrapeable? | Yes for listing metadata, but sits behind a Cloudflare JS challenge — requires a real/anti-detection browser (Camoufox), confirmed in current implementation. |
| Auth? | Not required. |
| Rate limits? | Not characterized; Cloudflare bot-detection is the effective control. |
| Legal | Not deeply assessed here; scraping public listing pages for factual metadata (address, BRF name) is lower-risk than reproducing listing content wholesale. |
| Reliability | High for the fields it does carry (address, BRF name) — n/a for website since it doesn't carry one. |
| Coverage | N/A — correctly scoped in the current codebase purely as an *upstream identity source*, feeding into allabrf.se/registry resolution, not a website source itself. |

**Verdict: dead end for website resolution, by design** — already correctly scoped as the pipeline's entry point, not a resolution source.

### 2.6 Booli.se

| Question | Answer |
|---|---|
| Exposes website? | No — checked a live BRF profile page; no website link present, most financial fields login-gated. |
| API? | None public. |
| Scrapeable? | JS-rendered/SPA-style pages (dynamic loading, pagination) raise scraping cost; robots.txt is fairly permissive on the relevant content paths. |
| Auth? | Login required for most financial detail. |
| Rate limits? | Not confirmed. |
| Legal | robots.txt permits crawling BRF-registry paths; GDPR relevant only if personal data appears (none observed on checked pages). |
| Reliability | 6/10 for financial data shown; N/A for website. |
| Coverage | Self-reported broad listing coverage (60-90%, unverified); 0% website field. |

**Verdict: dead end.**

### 2.7 Ratsit.se

| Question | Answer |
|---|---|
| Exposes website? | Not confirmed — no explicit website field found on checked pages. |
| API? | None official/public. |
| Scrapeable? | robots.txt blocks most transactional/search surface (`/kop/`, account paths, `/pdf/`) but allows `/sok/person/namn*`; 18 sitemaps indexed. |
| Auth? | Detailed reports behind subscription. |
| Rate limits? | Implied — subscription model plus heavy disallow list signals active anti-scraping. |
| Legal | High GDPR sensitivity — this is fundamentally a personal-data aggregator. |
| Reliability | 6/10 for general company data; unconfirmed for website field. |
| Coverage | Broad company-record coverage estimated 70-90%; ~0% for a website field. |

**Verdict: dead end**, and lower-priority to pursue further given the GDPR profile of the site.

### 2.8 Merinfo.se

| Question | Answer |
|---|---|
| Exposes website? | No evidence of a website field found. |
| API? | None public. |
| Scrapeable? | Minimal robots.txt (blocks only account/verify paths) — technically crawlable; runtime bot-detection not ruled out. |
| Auth? | Some features gated. |
| Rate limits? | Not confirmed. |
| Legal | GDPR-heavy (person/company lookup aggregator). |
| Reliability | Low confidence/unconfirmed for this use case. |
| Coverage | Unknown. |

**Verdict: dead end** (under-researched due to no positive signal in initial passes; not worth further investment).

### 2.9 brfnyckeln.se

Investigated as a possible aggregator based on the name — turned out to be a red herring. "brfnyckeln" only resolves to individual BRFs literally named "Nyckeln" (e.g. in Jarlaberg, Skellefteå, Köping), each running its own unrelated site. **No directory or lookup service exists at this domain.**

**Verdict: not a real source — drop from consideration.**

## 3. Property-Manager / Portal Sources

These are the organizations that manage BRFs' finances/administration and, in some cases, host or build BRF websites as part of that service. The critical question for each is not just "do they know the BRF's website" but **"do they expose a public, searchable directory that links out to it"** — most do not.

### 3.1 HSB (hsb.se) — Sweden's largest cooperative housing organization

| Question | Answer |
|---|---|
| Exposes website? | **Hybrid/partial.** HSB Stockholm's public "sök brf" directory (577 associations checked) links some BRFs to their own independent domain (e.g. `albatrossen.se`) and others only to an HSB-hosted page (`hsb.se/stockholm/brf/agaten/`) with no independent site. HSB operates 30+ separate regional associations, each with its own search page — this pattern would need to be verified/replicated per region. |
| API? | None public. |
| Scrapeable? | Directory pages are static-ish HTML; no Cloudflare-style block observed during research. |
| Auth? | Not required for the public directory. |
| Rate limits? | None discovered. |
| Legal | robots.txt disallows admin/search-result action paths but not the sök-brf listing pages themselves; GDPR relevant if board names appear on linked pages. |
| Reliability | 7/10 — HSB-maintained data, but the own-domain-vs-HSB-hosted-page distinction is inconsistent and must be handled explicitly (a `website_kind` field, as anticipated in `docs/34`, is directly needed here). |
| Coverage | Estimated ~25-30% of Sweden's BRFs are HSB-affiliated (HSB is the largest single cooperative organization in Sweden). |

**Verdict: promising, but requires per-region scraping plus fallback logic** for the ~half of results that are HSB-hosted pages rather than the BRF's own domain — genuinely useful data, non-trivial engineering.

### 3.2 SBC — Sveriges BostadsrättsCentrum (sbc.se)

No public directory of managed BRFs was found. The customer-facing portal ("SBC Hemma") is login/BankID-gated. robots.txt only blocks `/episerver/` (CMS admin paths), so the marketing site itself is technically open, but there is nothing to scrape that maps BRF→website. Estimated to manage 5,000+ associations (~10-15% of the national total), but that data is not independently resolvable from outside.

**Verdict: dead end** (no public discovery mechanism, despite meaningful market coverage).

### 3.3 Riksbyggen (riksbyggen.se)

No searchable BRF list exists on the public site. The "hitta din intresseförening" page lists only ~26 regional contact points covering an estimated ~1,700 BRFs in aggregate — not a per-BRF lookup, and carries no website links. The customer portal is login-gated. Riksbyggen manages an estimated 15-20% of Sweden's BRFs overall, none of it independently resolvable.

**Verdict: dead end.**

### 3.4 Nabo (nabo.se)

Nabo builds/hosts BRF websites as a product line (estimated ~3,400 customer associations, ~8-10% of the national total) but publishes no public index of which BRFs are customers or links to those sites. The management portal is BankID-gated.

**Verdict: dead end** — real coverage exists but with no discovery mechanism to reach it.

### 3.5 Fastum

No public directory. Estimated ~950 associations (~2-3% of the national total). Portal login-gated.

**Verdict: dead end.**

### 3.6 MBF

Disambiguated during research: in this context `mbf.se` is **"Mälardalens Bostadsrättsförvaltning"**, a regional property manager serving the Stockholm/Mälardalen area (~430 associations, ~16,000 apartments, ~1% of the national total). No other plausible meaning of "MBF" surfaced. No public directory; its "MBFOnline" tool is login-gated.

**Verdict: dead end**, and low-value even if it weren't, given the small coverage.

### 3.7 Simpleko (simpleko.se)

A Riksbyggen subsidiary providing BRF financial/admin software, serving an estimated 1,300+ associations (~3% of the national total). No public directory; portal login-gated.

**Verdict: dead end.**

### 3.8 Bredablick

The correct primary domain is `bredablickforvaltning.se` (`bredablickgruppen.se` is the parent group site). No public directory of managed BRFs was found. Customer BRF pages that do exist are actually hosted as subdomains of a *third-party* platform, `bostadsratterna.se` (run by the Bostadsrätterna trade association) — e.g. `brfvapnaren.bostadsratterna.se` — not on Bredablick's own domain at all.

**Verdict: dead end for Bredablick itself**, but this surfaces `bostadsratterna.se` as a new, structurally interesting lead (see §4).

## 4. Additional sources discovered during research (not originally scoped)

### 4.1 Hittabrf.se

A commercial B2B data vendor explicitly built for this exact use case. Claims coverage of **all 33,850 Swedish BRFs**, and its marketing explicitly states it maintains "länkar till Brf:ers hemsidor" (links to BRF websites), alongside board members, apartment counts, and financial plans. Paid tiers starting around 1,500 SEK/year; access is login-based; no public API was found.

| Question | Answer |
|---|---|
| Exposes website? | Yes, explicitly advertised as a maintained field. |
| API? | None found publicly; access appears to be via the paid web portal. |
| Scrapeable? | Not assessed in depth (paid/login-gated, so scraping would likely violate ToS regardless of technical feasibility). |
| Auth? | Yes, paid account required. |
| Rate limits? | Unknown. |
| Legal | Paid commercial product — the intended access path is a data license/subscription, not scraping. |
| Reliability | Unverified directly, but purpose-built and comprehensive by design; commercial vendors have a business incentive to keep this accurate. |
| Coverage | Claims ~100% (33,850 BRFs) — the highest claimed coverage of any source found. |

**Verdict: promising, but as a paid data licensing decision, not an engineering/scraping one.** Worth a direct vendor inquiry before building anything against it.

### 4.2 SvenskBrf.se

A public, free search (`svenskbrf.se/forening/sok`) claiming to cover all Swedish BRFs. Spot-checked examples (Brf Lilium in Uppsala, Brf Drevviksterrassen) appeared to link out to independently-hosted BRF websites.

| Question | Answer |
|---|---|
| Exposes website? | Appears yes, based on spot checks — needs a dedicated follow-up pass to confirm consistency and check robots.txt/ToS/rate limits properly. |
| API? | Not found; likely HTML scraping only. |
| Scrapeable? | Not fully assessed — flagged as the top follow-up item from this research pass. |
| Auth? | Public search, no login observed. |
| Rate limits? | Unknown — not assessed. |
| Legal | Not assessed — needs a robots.txt/ToS check before any scraping. |
| Reliability | Unverified at scale; spot checks were positive. |
| Coverage | Claims comprehensive (all Swedish BRFs); unverified. |

**Verdict: the single highest-priority follow-up** — free, public, and structurally exactly what's needed, but not yet verified in depth.

### 4.3 Brfregistret.se

A commercial contact-data register (email/postal contact info for BRFs). Not examined in depth during this pass; noted for a future look but lower priority than 4.1/4.2 since its focus (contact data) doesn't obviously include the website field.

### 4.4 Bostadsratterna.se

Surfaced via the Bredablick investigation (§3.8): hosts individual BRF sites as subdomains (`brfXXX.bostadsratterna.se`) for member associations of the Bostadsrätterna trade association. This is a structurally interesting pattern (one predictable subdomain per BRF) worth checking as a potential free, structured source — not yet assessed for coverage, API, or scraping feasibility.

## 5. Summary table

| Source | Website exposed? | API | Auth needed | Reliability | Est. coverage | Verdict |
|---|---|---|---|---|---|---|
| Bolagsverket | No | Official (paid/agreement) | Yes (API) | 10/10 (identity only) | ~100% identity, 0% website | Identity-only, keep |
| Allabolag.se | No | None | Partial | 8/10 (financial) | 0% website | Dead end |
| Hitta.se | Unconfirmed | Paid, wrong domain | Yes | Unknown | Unknown | Dead end |
| **allabrf.se** | **Yes** | Public unofficial endpoints in use | No (docs gated) | **8/10** | **~55-80%** | **Already integrated — keep as primary** |
| Hemnet.se | No (by design) | None | No | N/A | N/A (identity source) | Correctly scoped, not a resolution source |
| Booli.se | No | None | Partial | 6/10 | 0% website | Dead end |
| Ratsit.se | Unconfirmed | None | Partial | 6/10 | ~0% website | Dead end |
| Merinfo.se | No evidence | None | Partial | Low/unconfirmed | Unknown | Dead end |
| brfnyckeln.se | N/A | N/A | N/A | N/A | N/A | Not a real source |
| **HSB** | **Partial (hybrid)** | None | No | 7/10 | ~25-30% | **Promising, needs per-region + fallback logic** |
| SBC | No | None | Portal gated | N/A | ~10-15% (unreachable) | Dead end |
| Riksbyggen | No | None | Portal gated | N/A | ~15-20% (unreachable) | Dead end |
| Nabo | No | None | Portal gated | N/A | ~8-10% (unreachable) | Dead end |
| Fastum | No | None | Portal gated | N/A | ~2-3% (unreachable) | Dead end |
| MBF | No | None | Portal gated | N/A | ~1% (unreachable) | Dead end |
| Simpleko | No | None | Portal gated | N/A | ~3% (unreachable) | Dead end |
| Bredablick | No | None | Portal gated | N/A | Unreachable | Dead end (leads to Bostadsratterna.se) |
| **Hittabrf.se** | **Yes (claimed)** | None found (paid portal) | Yes (paid) | Unverified, likely high | **~100% (claimed)** | **Promising — licensing decision** |
| **SvenskBrf.se** | **Yes (spot-checked)** | None found | No | Unverified | Claimed comprehensive | **Promising — top follow-up** |
| Brfregistret.se | Unassessed | Unassessed | Unassessed | Unassessed | Unassessed | Needs follow-up (low priority) |
| Bostadsratterna.se | Unassessed (structural lead) | Unassessed | Unassessed | Unassessed | Unassessed | Needs follow-up |

## 6. Recommended acquisition strategy

Ranked by scalability, reliability, and maintenance cost — this directly informs the `trust_tier` ordering in `docs/34_brf_registry_architecture.md` §5.2.

### Tier 1 — Primary automated sources (build now)

1. **allabrf.se** (already integrated). Best cost/reliability ratio available: free, no auth for the fields needed, ~55-80% coverage, already validated end-to-end in this codebase including document discovery/download. Keep as the default `DIRECTORY`-tier provider.
2. **Bolagsverket org-number cross-check** (identity only, not website). Zero-cost, highest-trust confirmation that a resolved BRF identity is correct before persisting a website match — cheap insurance against name-collision errors, not a website source itself. Keep as the `REGISTRY_AUTHORITY` tier for *verification*, not discovery.

### Tier 2 — High-value follow-up before further build-out (research, 1-2 days)

3. **SvenskBrf.se** — free, public, claims full coverage, spot-checks positive. This is the single highest-leverage next step: if a proper robots.txt/ToS/reliability check confirms it behaves like allabrf.se, it should become a second `DIRECTORY`-tier provider and meaningfully raise coverage beyond allabrf.se's ~55-80% ceiling at effectively zero marginal cost.
4. **HSB regional directories** — real, meaningful coverage (~25-30%) at zero cost, but nontrivial engineering: 30+ regional sub-sites to handle, and a mandatory `website_kind` distinction (own domain vs. HSB-hosted page) already anticipated in the registry schema. Worth building once Tier 1 + SvenskBrf.se are exhausted for a given BRF — i.e. as the `MANAGER_PORTAL` tier's first occupant.

### Tier 3 — Commercial/licensing decision (business decision, not engineering)

5. **Hittabrf.se** — claims the best coverage of any source found (~100%), but the intended access path is a paid subscription, not scraping. If Tier 1+2 coverage proves insufficient in production (i.e. `website_missing` rate stays high after real usage), a direct vendor conversation about API/bulk-data access is more scalable and lower-maintenance than trying to scrape a paid, login-gated portal — and avoids the legal exposure of scraping a commercial data product against its ToS.

### Tier 4 — Not worth building (confirmed dead ends)

6. **SBC, Riksbyggen, Nabo, Fastum, MBF, Simpleko, Bredablick** — collectively manage a large share of Sweden's BRFs (rough sum of estimates: 40-60%, with unavoidable double-counting since these estimates overlap and some BRFs self-manage), but **none expose a public directory**. Building scrapers against their login-gated customer portals would mean either violating ToS/authentication boundaries or requires individual partnership agreements per vendor — neither is a scalable engineering investment relative to Tier 1-3. Do not build against these unless a specific partnership emerges.
7. **Allabolag.se, Booli.se, Ratsit.se, Merinfo.se, Hitta.se** — general-purpose company/property lookup sites that either actively block scraping (robots.txt disallow lists) or simply don't carry a website field for BRFs. Not worth further investment.
8. **brfnyckeln.se** — not a real aggregator; drop entirely.

### Net effect on registry design

This validates `docs/34`'s trust-tier structure (`REGISTRY_AUTHORITY` → `MANAGER_PORTAL` → `DIRECTORY` → `USER`) but changes its *contents*: the `MANAGER_PORTAL` tier's originally-scoped occupants (HSB, SBC, Riksbyggen, Nabo) collapse to **HSB alone** being buildable; the `DIRECTORY` tier gains a second real candidate (**SvenskBrf.se**, pending the Tier-2 follow-up); and a **commercial-licensing tier is worth adding to the design** as an explicit fallback path (Hittabrf.se) for BRFs that clear neither automated tier — cheaper in the long run than an ever-expanding portal-scraping surface, and it directly reduces the `website_missing` rate that the user-submission flow (`docs/34` §5.4) would otherwise have to absorb entirely.
