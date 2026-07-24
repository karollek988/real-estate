# User Journey

**Date:** 2026-07-13 · **Sprint:** 3

## First visit

A user has found a listing on Hemnet or Booli — maybe they're seriously
considering it, maybe just curious. They paste the listing URL (or
address) into our site.

**What happens:** in the time it takes to read one paragraph, they see
three things above the fold:

1. **Price verdict** — "Asking 4,200,000 kr. Comparable sales suggest a
   fair range of 4,000,000–4,350,000 kr. This looks fairly priced."
   (or "This looks likely to sell well above asking" / "This looks
   overpriced relative to comparables.")
2. **BRF / structural health** — a single traffic-light signal (green /
   yellow / red) with the one-line reason: "Yellow — debt per m² is
   above area average, and 60% of the BRF's loans reset within 2 years."
3. **Area trajectory** — "This area's prices are up 6% over 2 years; a
   new metro station is planned for 2029; school ratings are stable."

**What they immediately see:** a verdict first, evidence second. No
dashboards, no login wall, no "create an account to see your result."

**What insights do they receive:** the plain-language verdict, and one
tap away, the underlying evidence in the register/filing it came from —
so they can verify, not just trust.

**What makes them stay:** the "why" behind each verdict is genuinely
useful even if they don't buy this specific object — they learn to read
a BRF report a little themselves, which builds trust rather than
dependency.

**What makes them return:** they save the object (or search by address
again), and importantly, they come back with the *next* listing they're
considering — because now they know the tool exists and what it answers.
Over a bidding process that runs days to weeks, they check back
repeatedly as bids come in and they reconsider.

## Later in the journey (still Sprint-3 scope: describing intent, not building)

Once a user has looked at a handful of objects, the product should
naturally surface: "you've looked at 4 objects in this BRF's building —
here's a comparison," and "you're comparing 3 areas — here's how they
differ on the things you've been checking (schools, commute, price
trend)." This is a natural consequence of already having the object-level
analysis, not a new capability to be built separately later.

## Trust mechanics (why the journey works)

Every verdict must resolve to a citable source (Bolagsverket filing,
Lantmäteriet register, SCB statistic) a skeptical user can click through
to. The moment a verdict feels unexplained, trust breaks — this is the
single most important interaction-design constraint on the whole
product, because the entire value proposition is "trustworthy analysis a
broker won't give you." An unexplained verdict is indistinguishable from
a broker's sales pitch.
