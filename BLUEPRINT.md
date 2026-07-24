# Köpanalys Master Pipeline & Product Blueprint

> **Status: GOVERNING DOCUMENT.** Adopted 2026-07-18. This is the single source of truth
> for how Köpanalys works. Read and follow it before any code change, architectural
> decision, or feature implementation. If a future prompt conflicts with this document,
> explain why before making changes. Never redesign the architecture unless explicitly
> instructed. Conformance mapping against the actual codebase: docs/32_blueprint_alignment.md.

---

# Product Vision

Köpanalys is an AI-powered decision support platform for residential properties in Sweden.

We are NOT building another valuation website.

We are building a system that answers one question:

**"Should I buy this property at this price?"**

Every feature should contribute towards answering that question.

---

# Core Principle

Every analysis is evidence-based.

Every score must be traceable.

Every conclusion must explain WHY.

Never guess.

If information cannot be verified, report it honestly.

---

# Analysis Pipeline

Every analysis follows the exact same pipeline.

User pastes:

- Property address
or
- Property advertisement URL

↓

**Property Identification**

Extract: Address, Municipality, BRF name, Property type, Rooms, Living area, Monthly fee,
Asking price, Floor, Year built, Operating costs, Land ownership, Listing information,
Images (optional)

↓

**Property Data Engine**

Collect everything directly related to the property.

Examples: Asking price, Monthly fee, Living area, Size, Balcony, Elevator, Energy class,
Building year, Renovations, Floor, Ownership type

↓

**BRF Engine**

Find the housing association.

Collect: Annual reports, Financial statements, Debt per square meter, Loans, Savings,
Cash flow, Number of apartments, Commercial premises, Rental apartments, Upcoming
renovations, Completed renovations, Fee increases, Board information, Property addresses,
Building years

Produce: **BRF Health Score**

↓

**Price Engine**

Determine if the asking price is reasonable.

Compare against: Sold apartments, Area trends, Current listings, Price per sqm, Similar
apartments, Market trends

Output: Undervalued / Fairly priced / Overpriced — with explanation.

↓

**Fee Engine**

Determine whether the monthly fee is: Low / Fair / High

Compare against: Similar apartments, Similar BRFs, Debt, Building age, Maintenance needs

↓

**Area Engine**

Collect: Crime statistics, Public transport, Schools, Healthcare, Grocery stores, Parks,
Restaurants, Noise, Flood risk, Demographics, Population trends

↓

**Future Development Engine**

Investigate future changes.

Examples: New subway stations, New commuter rail, New schools, Infrastructure projects,
Major construction, Municipal development plans

Explain how these may affect the property's future value.

↓

**Market Engine**

Collect macroeconomic information.

Examples: Interest rates, Inflation, Housing market trends, Supply, Demand

↓

**Risk Engine**

Combine all available information.

Identify risks such as: Weak BRF, High debt, Planned renovations, High monthly fee, Weak
local market, Flood risk, Crime, Legal issues, Ground lease, Noise

↓

**Decision Engine**

This is our competitive advantage.

It combines every engine into one overall assessment.

The Decision Engine must never rely on a single factor.

Instead it weighs evidence from every engine.

Outputs: **Buy / Buy with caution / Negotiate / Avoid**

Every recommendation must include detailed reasoning.

---

# Report Generator

Convert all collected data into a beautiful report.

The report should be readable within 5–10 minutes.

It should feel like reading a professional investment report.

Use: Risk indicators, Charts, Maps, Scores, Tables, AI summaries, Highlight boxes.

Every section should answer a specific question. Examples:

- "Is the asking price reasonable?"
- "How healthy is the BRF?"
- "What risks exist?"
- "What will likely increase future value?"
- "What should I ask the real estate agent?"

---

# MVP Priorities

We are NOT building everything at once.

**Priority 1 — A complete report for one apartment.** Must include:
Property information · BRF analysis · Price analysis · Monthly fee analysis · Crime ·
Future infrastructure · Schools · Decision score

**Priority 2** — Area analysis

**Priority 3** — Portfolio

**Priority 4** — Inspection Assistant

**Priority 5** — AI Chat

---

# Existing Code

Before implementing anything, always inspect the repository.

Identify: existing implementations, APIs, providers, scrapers, database tables.

Reuse existing code whenever possible. Do not rewrite working code.

---

# Development Rules

When implementing a feature:

1. Check if it already exists.
2. Check if an open-source solution exists.
3. Check if our architecture already supports it.
4. Build only the missing piece.

Never create duplicate functionality.

Never replace working code without a clear reason.

Always keep the pipeline up to date.

If new functionality changes the architecture, update this document before writing code.

This document should evolve together with the project and always remain the architectural
blueprint for Köpanalys.
