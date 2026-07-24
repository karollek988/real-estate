# MVP Definition

**Date:** 2026-07-13 · **Sprint:** 3

## The MVP

A single-page tool: paste a Hemnet/Booli listing URL or address for a
Stockholm bostadsrätt, get back:

1. A fair-price range versus comparable sales in the area
2. A BRF financial-health traffic light with a one-line reason
3. A "why" panel citing the specific public source for both

That's it. No accounts, no saved searches, no area trend page, no house
support, no investor screening.

## Why this is the smallest thing that's still genuinely valuable

It answers the two highest-frequency, highest-stakes questions
(Problems 1 and 3/12 in [[10_user_problems]]) for the largest segment
(apartment buyers, who dominate Stockholm's market) using the two data
sources we've already confirmed are free, reliable, and legally usable
today (Bolagsverket for BRF filings, Lantmäteriet/public comparables for
pricing context) — see `data-source-inventory.md`. A user gets a
complete, trustworthy answer to a real question in one sitting, with
nothing half-built exposed to them.

## Explicitly excluded from V1, and why

- **Houses (villa/radhus):** different data sources (besiktning-adjacent
  risk, no BRF equivalent), different verdict shape — doubling the
  problem space before validating the core loop on one segment.
- **Area context (schools, safety, transit):** Should Have, not Must
  Have — valuable but not the thing that stops someone from bidding
  blind on price and BRF risk, which are the two things with no
  existing consumer-facing answer at all.
- **Compare/save multiple objects:** requires the single-object verdict
  to already be trustworthy and used before a comparison view has
  anything real to compare.
- **Accounts/login:** adds friction to the exact moment (a user with a
  listing open, deciding fast) where friction kills adoption; nothing in
  the MVP requires persistence across sessions.
- **Investor screening across many objects:** valuable but presupposes
  the single-object verdict already works and is trusted; screening a
  market with an unproven verdict just scales an unproven thing.
- **Negotiation coaching:** requires the price verdict to already be
  validated in the field before we layer advice on top of it.

## What "genuine value" means for this MVP specifically

A user who pastes in a real listing and gets a price range and a BRF
risk flag they can independently verify against the cited source has
received something no free tool gives them today — even if they never
come back, that single interaction is worth more than what Hemnet's
"sold nearby" panel or a skimmed annual report gives them now.
