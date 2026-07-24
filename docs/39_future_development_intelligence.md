# 39 — Future Area Development Intelligence

**Date:** 2026-07-20 · **Status:** implemented (one provider) + source survey for the rest.
**Predecessors:** `docs/36` (original source catalog, §2.1/§2.10), `docs/38`
(provider catalog P7/P8/P13/P14), and the shared proximity framework in
`location_intelligence.proximity` (a prior deliverable this session —
every finding below carries proximity metadata via that module).

---

## 0. Scope contract (same as doc 38 §0, restated)

This engine **collects and normalizes only**. Nothing below scores,
ranks, predicts, or recommends. "Future development intelligence" here
means: surface *what a municipality or infrastructure authority is
officially doing or planning to do* to an area, with full provenance —
never *whether that's good or bad for a buyer*.

Requested categories (this task) and their disposition:

| # | Category | Disposition |
|---|---|---|
| 1 | Municipal detailed development plans (detaljplaner) | **Built** — `lantmateriet_detaljplan` |
| 2 | Ongoing planning processes | **Built** — same provider, `status` field |
| 3 | Planned residential developments | **Partial** — same provider (plan-level, not use-type-split) + existing `osm_construction` |
| 4 | Commercial developments | **Partial** — same as #3 |
| 5 | Public buildings | **Not built** — no dedicated official source found |
| 6 | Infrastructure projects | **Already built** (doc 38 P8, `trafikverket_infrastructure`, pre-existing) |
| 7 | Transit expansion | **Partially covered** — same existing Trafikverket provider; a distinct "named major project" object type could not be confirmed |
| 8 | Major road projects | **Already built** — same Trafikverket provider |
| 9 | Public consultation documents (samråd) | **Partial** — same detaljplan provider (`status: samråd` flags the phase; no dedicated consultation-notice feed exists) |
| 10 | Construction permits (bygglov) | **Not built** — no unified national API exists, confirmed unchanged from doc 36 |

---

## 1. What got built: Lantmäteriet detaljplan (Nationella geodataplattformen)

### 1.1 Why this source, over Boverket's catalogs

Doc 36 §2.1 researched Boverket's **Planbestämmelsekatalogen** (plan
*provision* vocabulary, ~3,650 standardized clause codes) and
**ÖP-katalogen** (comprehensive-plan *metadata*). Both are real, free,
official APIs — but neither answers "what's the status of the plan
covering or near this address," because neither is per-plan case data.
Doc 36 concluded (§2.1 "Finding") that no unified per-address planning
API existed and recommended kommun-by-kommun diarium scraping as the only
path to real case status — explicitly flagged high-maintenance (Tier 3,
doc 38 §5).

That conclusion predates a 2022+ national rollout doc 36 didn't catch:
Sweden's **lag om digitala detaljplaner** (2022) requires municipalities
to deliver new detaljplaner in a standardized digital format to
Lantmäteriet's **Nationella geodataplattformen (NGP)**. This *is* the
per-plan, per-address, structured national API doc 36 said didn't exist.
Verified live this session against the platform's own OpenAPI 2.2 spec
and JSON Schema (fetched directly from
`namespace.lantmateriet.se/distribution/geodatakatalog/sokning/v1/detaljplan/v2/`,
not secondhand documentation):

- **Access**: OGC API Features + STAC hybrid REST API,
  `https://api.lantmateriet.se/distribution/geodatakatalog/sokning/v1/detaljplan/v2/search`
  (GET or POST, bbox/polygon/attribute filtering, pagination).
- **Auth**: OAuth2 client-credentials, token endpoint
  `https://api.lantmateriet.se/token`. Requires an organization account
  via Lantmäteriet's Geotorget (~2 business days approval per
  Lantmäteriet's published process) — not literally keyless, but the
  same access-model shape as `TRAFIKVERKET_API_KEY` (free registration,
  no per-request cost found), not a paid/commercial tier.
- **Per-plan fields** (from the live `detaljplan-ref-2.2.json` schema):
  `objektidentitet` (id), `beteckning` (case reference), `namn` (name),
  `status` (`påbörjad`/`samråd`/`granskning`/`antagen`/`överklagad`/
  `tillsyn`/`laga kraft`/`upphävd`/`avslutad`), `typ`, `datumPaborjat`,
  `datumStatusforandring`, `datumLagakraft`, plus a `geometry` (plan-area
  polygon) and `assets` (document links: `beslutshandling`,
  `planbeskrivning`, `grundkarta`, `planeringsunderlag`).
- **Coverage caveat, stated explicitly by Lantmäteriet**: only plans
  *begun* on/after 2022-01-01 are mandated to be here. A search snippet
  (unverified — could not open the source page) claimed ~252
  municipalities and ~16,000 plans as of an unspecified "April" date;
  treat coverage as **growing but partial**, not exhaustive, and this is
  reflected verbatim in the provider's `detaljplan_count_within_2000m`
  finding's `detail` field rather than papered over.

This single source is why detaljplaner, ongoing planning status, and the
public-consultation phase (`samråd` literally *is* the plan being open
for public comment) could all be answered by one provider instead of
three.

### 1.2 What's honestly unverified

No credentials were available this pass to make a live call, so:

- **Field mapping** is grounded in the live OpenAPI/JSON-Schema files
  (fetched and read directly, not guessed) — high confidence.
- **Response coordinate axis order** for the requested `EPSG:4326` CRS is
  genuinely unverified — real-world OGC API Features servers disagree on
  lon/lat vs. lat/lon for this CRS despite the nominal ISO convention.
  The provider self-corrects using Sweden's non-overlapping latitude
  (~55-69°) / longitude (~10-24°) ranges (`_to_lat_lon`), so it degrades
  safely regardless of which order the live API actually returns —
  same "document the unverified part, build defensively around it"
  posture doc 28/38 already established for Trafikverket's field mapping.
- **Query bbox axis order** is inferred by analogy to the SWEREF99TM
  example in the spec (easting-then-northing → lon-then-lat), not
  confirmed live. Worst case if wrong: an empty or 4xx result, which the
  provider already turns into an honest `no_data`/`error` — never a
  silently wrong answer.

Both should be confirmed against a live response once credentials exist
(a natural first task once `LANTMATERIET_CLIENT_ID`/`_SECRET` are
provisioned) — flagged here rather than left implicit.

### 1.3 What it does *not* cover (documented, not silently dropped)

- **Use-type breakdown** (residential vs. commercial vs. public within a
  plan) lives at the `planbestammelse` (plan-provision) level of this
  same API, not the `detaljplan` level this provider queries. Fetching
  and joining that second object type is a natural extension, not built
  this pass to keep the auth/parsing surface reviewable in one piece.
- **Individual consultation-notice details** (comment deadline, meeting
  venue, how to submit a response) are not in this API — `status:
  samråd` tells you a plan is *in* that phase, not the notice itself.
  No national source for that was found (§4 below).

---

## 2. Categories already served by existing providers

**Infrastructure projects / major road projects / partial transit
expansion** (categories 6, 8, 7): `trafikverket_infrastructure.py`
(doc 38 P8, built prior to this session) already queries Trafikverket's
`Situation`/`Deviation` objects for roadworks, rail projects, and traffic
disruptions within a radius — its own docstring already scopes this as
covering "rail projects — including transit expansion such as new
metro/rail lines under construction." This session searched for a
*distinct* object type specifically for long-term named investment
projects (as opposed to short-term disruptions) and could not confirm or
rule one out — Trafikverket's interactive API docs are JS-rendered and
didn't yield to automated fetching this pass. **Recommendation**: once a
`TRAFIKVERKET_API_KEY` is available, query the API's own `DataInfo`/model
endpoint live to settle this definitively, rather than guess at an object
type name and build against it unverified — unlike the Lantmäteriet case
above, there's no live-fetched schema to build against here, so
speculative implementation was avoided per this task's instruction not to
guess at fragile sources.

**Planned residential/commercial developments** (categories 3, 4):
served today by (a) `osm_construction.py` (any tagged construction site,
regardless of use) and (b) the new detaljplan provider at the plan level
(a plan names an area, not yet a use-type breakdown — see §1.3). A true
"is this specifically residential or commercial" signal needs the
`planbestammelse` extension noted above.

---

## 3. What was investigated and NOT built, with reasons

### 3.1 Public buildings (schools/healthcare/sports facilities beyond Skolverket)

**Investigated**: Specialfastigheter, Regionfastigheter, SISAB, and a
general search for a national "planned public building" registry.
**Finding**: no dedicated official Swedish source located. Riksantikvarie-
ämbetets Bebyggelseregistret is a heritage-building registry (existing
buildings of cultural value), not planned new construction — not a match.
**Recommendation**: no fragile scraper built. The only honest current
proxies are (a) Skolverket's `planned_school_count`/`planned_schools`
(already built, doc 38 P5, schools specifically) and (b) OSM
`building=construction` tags via the existing construction provider,
which will catch a new public building if and when it's tagged in OSM —
same community-data caveats as everywhere else OSM is used here. If a
buyer needs planned-healthcare-facility signal specifically, that
remains a genuine gap; flagged for a future pass rather than filled with
a guess.

### 3.2 Public consultation documents (samråd) — beyond the detaljplan status flag

**Investigated**: Boverket's PBL Kunskapsbanken (publishes annual
aggregate statistics on planning processes, not a live per-notice feed),
Sveriges Kommuner och Regioner (SKR) — no structured feed found.
**Finding**: confirms doc 36 §2.1's implicit gap. There is no national
aggregator of individual samråd notices (deadline, venue, how to
comment) — this remains purely per-kommun HTML, the same fragmentation
problem doc 36 documented for local news (§2.7) and bygglov (below).
**Recommendation**: do not build a 290-kommun HTML scraper for this.
The detaljplan provider's `status: samråd` field is the honest, currently
buildable signal ("a plan affecting this area is in consultation right
now") — good enough to alert, not detailed enough to act on without
visiting the kommun's own page (whose URL a user can find via the plan's
`case_reference` and `authority` fields already in the finding).

### 3.3 Construction permits (bygglov)

**Investigated**: Stockholm's, Göteborg's, and Norrköping's bygglov
e-services; vendor platforms ByggR, Castor, Vision. **Finding**: confirms
doc 36 §2.1 exactly — still no unified national bygglov API as of this
pass. Every kommun runs its own e-service (often one of the ~3 vendor
platforms), none expose a documented bulk/open API. This is precisely
the "fragile scraper" case this task's instructions say not to build:
290 different bespoke systems, no ToS/rate-limit clarity, high ongoing
maintenance for uncertain benefit per kommun covered.
**Recommendation**: unchanged from doc 38's own roadmap (§Wave 8,
L-04/L-05) — a single-kommun (Stockholm) diarium adapter is the correct
next step *if* this becomes a priority, but only after a feasibility
memo and, per this project's established scraping discipline (doc 35
§5-6 precedent), a ToS/legal check — not attempted in this pass, which
was scoped to genuinely available structured APIs.

---

## 4. Demonstration

See the engine run in the session transcript: `lantmateriet_detaljplan`
findings for Dalagatan 30, Stockholm, using canned upstream payloads (the
project's established no-live-network demo convention, matching the
proximity-framework demo before it) — each finding carrying source,
title, authority (municipality), publication/status dates, geographic
reference (representative point + bbox), proximity metadata
(`distance_m`/`radius_bucket`/`inside_requested_radius`), the plan's own
identifier/URL-bearing documents, and raw upstream metadata, exactly as
the task specified.
