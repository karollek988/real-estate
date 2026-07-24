# Bostadsradar Design System — Color Palette v1.1 (as implemented)

**Date:** 2026-07-16 · **Type:** Frontend reference — the single source of truth for colors

This palette is documented **from the current implemented design** (landing page, mobile landing, auth modal — the screens that define the visual language). Use these tokens for all future frontend work. Prefer the Tailwind class where one exists; use arbitrary values (e.g. `bg-[#111927]`) for the custom hexes.

> **Legacy note:** `/report` and `/analyzing` are older light/dark-adaptive prototypes (`bg-neutral-50 dark:bg-neutral-950`, emerald/amber/red badge tints). They predate this design language and are pending redesign — do **not** copy colors from them.

## Primary / Accent (Tailwind stock greens)

| Token | Value | Tailwind | Used for |
|---|---|---|---|
| Accent | `#4ADE80` | `green-400` | Icons, links, emphasized words, chart lines — the most-used accent |
| Primary Green | `#22C55E` | `green-500` | Active tab underlines, stars, filled accents, button hover |
| Primary Green Deep | `#16A34A` | `green-600` | Primary button background (buttons **lighten** on hover: 600 → 500) |
| Accent Hover (links) | `#86EFAC` | `green-300` | `hover:text-green-300` on green text links |
| Accent Tint | `rgba(34,197,94,0.10)` | `bg-green-500/10` | Tinted icon boxes (e.g. logo mark), paired with `border-green-500/40` |

## Backgrounds

| Token | Value | Tailwind | Used for |
|---|---|---|---|
| Main Background | `#111927` | `bg-[#111927]` | Page body below the hero |
| Header / Hero Base | `#0A0F0D` | `bg-[#0A0F0D]` | Header bar, hero section base, mobile auth screen base |
| Hero Fade Target | `#0D121A` | `rgba(13,18,26,x)` | Hero gradients fade into this before meeting `#111927` |
| Card / Modal Surface | `#0F1417` | `bg-[#0F1417]` | Input cards (at /95, /90, /85 opacity + blur), auth modal (solid) |
| Panel Surface | `#0C110F` | `bg-[#0C110F]/85` | Market overview panel |
| Subtle Surface | `rgba(255,255,255,0.03–0.06)` | `bg-white/[0.03]`…`[0.06]` | Stat tiles (`0.03`), trust card (`0.04`) |
| Ghost Surface | `rgba(255,255,255,0.05)` | `bg-white/5`, hover `bg-white/10` | Secondary/social buttons, site pills |
| Input Surface | `rgba(0,0,0,0.40)` | `bg-black/40` | All text inputs |

## Borders

| Token | Value | Tailwind | Used for |
|---|---|---|---|
| Primary Border | `rgba(255,255,255,0.10)` | `border-white/10` | Default border on every card, input, button, divider |
| Hairline | `rgba(255,255,255,0.05)` | `border-white/5` | Menu item separators, footer rule |
| Strong / Hover | `rgba(255,255,255,0.15–0.20)` | `border-white/15`, `border-white/20` | Checkbox box, secondary-button hover |
| Active | `#22C55E` | `border-green-500`, `bg-green-500` (underline span) | Active tab underline, checked checkbox |
| Input Focus | `rgba(34,197,94,0.60)` | `focus:border-green-500/60` | Always with `focus:ring-4 ring-green-500/10` |
| Accent Border | `rgba(34,197,94,0.25–0.40)` | `border-green-500/25`…`/40` | Tinted icon boxes, highlighted chips |

## Text

| Token | Value | Tailwind | Used for |
|---|---|---|---|
| Primary Text | `#FFFFFF` | `text-white` | Headlines, button labels |
| Bright | `#F5F5F5` | `text-neutral-100` | Secondary button labels |
| Label | `#E5E5E5` | `text-neutral-200` | Form labels, chips |
| Body | `#D4D4D4` | `text-neutral-300` | Paragraphs, nav links, hero subtext |
| Muted | `#A3A3A3` | `text-neutral-400` | Descriptions, helper text, inactive tabs |
| Faint / Placeholder | `#737373` | `text-neutral-500` | Placeholders, footnotes, input icons |
| On-White | `#171717` | `text-neutral-900` | Text on white buttons ("Logga in") |
| Chart Axis | `#7C847F` | `fill="#7c847f"` | SVG chart axis/labels only |

## Status Colors

| Token | Value | Tailwind | Used for |
|---|---|---|---|
| Success / Positive | `#4ADE80` | `green-400` (tint: `emerald-500/10` + `emerald-400`) | Positive deltas, "Good Buy" |
| Warning | `#FBBF24` | `amber-400` (tint: `amber-500/10`) | "Fair Price" / caution states |
| Error / Negative | `#F87171` | `red-400` (tint: `red-500/10`) | Overpriced, risk flags |
| Information | `#38BDF8` | `sky-400` | Neutral chart series (reserved, barely used yet) |

## Buttons

| Token | Value | Tailwind |
|---|---|---|
| Primary Background | `#16A34A` | `bg-green-600` |
| Primary Hover | `#22C55E` | `hover:bg-green-500` |
| Primary Text | `#FFFFFF` | `text-white` |
| Contrast (nav "Logga in") | white bg, `#171717` text | `bg-white text-neutral-900 hover:bg-neutral-200` |
| Secondary / Social | `bg-white/5` + `border-white/10` | hover: `bg-white/10` + `border-white/20` |

## Inputs

| Token | Value | Tailwind |
|---|---|---|
| Background | `rgba(0,0,0,0.40)` | `bg-black/40` |
| Border | `rgba(255,255,255,0.10)` | `border-white/10` |
| Focus | `border-green-500/60` + `ring-4 ring-green-500/10` | — |
| Placeholder | `#737373` | `placeholder:text-neutral-500` |
| Text | `#FFFFFF` | `text-white` |
| Leading icon | `#737373` | `text-neutral-500` |

## Charts

| Token | Value | Notes |
|---|---|---|
| Positive line / points | `#4ADE80` | Main series color |
| Line glow | `rgba(74,222,128,0.26)` / `rgba(74,222,128,0.45)` | Wide stroke behind line / point halos |
| Grid | `rgba(255,255,255,0.08)` | Dashed (`3 4`) |
| Axis labels | `#7C847F` | 8.5px SVG text |
| Negative | `#F87171` | `red-400`, reserved |

## Glow

| Token | Value | Used for |
|---|---|---|
| Divider Glow | `rgba(74,222,128,0.18)` | `box-shadow` under section dividers |
| Section Accent Glow | `rgba(74,222,128,0.14)` | Section intro radial accents |
| Divider Gradient | `rgba(115,125,120,0.35)` → `rgba(74,222,128,0.4)` → back | `.section-divider` horizontal gradient |

## Shadows

| Token | Value | Used for |
|---|---|---|
| Hero / Modal Shadow | `0 24px 60px rgba(0,0,0,0.45)` | Mobile input card, auth modal panel |
| (Report cards, legacy) | `shadow-sm` | Old prototype pages only |

## Glass Effect

| Token | Recipe |
|---|---|
| Glass Card | `bg-[#0F1417]/85–95` + `backdrop-blur-xl` + `border-white/10` |
| Glass Pill | `bg-black/50` + `backdrop-blur-md` + `border-white/10` + `rounded-full` |
| Glass Menu (mobile) | `bg-[#0A0F0D]/95` + `backdrop-blur-xl` + `border-b border-white/10` |
| Modal Backdrop | `bg-black/60` + `backdrop-blur-sm` |

## Hero Overlays (over `hero-background.png`)

Layered in order:

1. Flat dim: `bg-black/45`
2. Left-to-right: `from-black/60 via-black/25 to-transparent`
3. Bottom fade: `transparent 42%` → `rgba(10,15,13,0.72) 72%` → `rgba(13,18,26,0.98) 100%`
4. Bottom-right radial: `rgba(13,18,26,0.97)` → `0.82` → `0.4` → transparent

Mobile auth variant: `bg-black/70` + vertical `rgba(10,15,13,0.55 → 0.35 → 0.8 → 0.95)`.

## Non-obvious conventions

- **Buttons lighten on hover** (green-600 → green-500); green text links also lighten (green-400 → green-300). Nothing darkens on hover in this design.
- Surfaces are built from **white-alpha on dark hexes**, not from lighter solid hexes — keeps the glass look consistent over imagery.
- The green family is **Tailwind stock** (`green-300/400/500/600`) — never introduce custom greens.
- Brand icons (Google/Apple/Microsoft in `icons.tsx`) keep their official colors and are exempt from the palette.
