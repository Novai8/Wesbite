# Fyndra — Design System

Fyndra is the working brand for this platform (centralised in `src/lib/site.ts`, swappable in one place). The visual direction: **editorial commerce meets AI-powered product discovery** — a premium product research publication crossed with an intelligent shopping assistant.

## Design plan (decided, then built)

- **Concept.** A research publication that answers shopping questions. Content-first grids, real product photography, generous whitespace, and one signature element: the **answer bar** — a warm-tinted panel framing every recommendation with its reasoning, like an annotated research note.
- **Color.** Warm off-white paper `#FAF9F6`, deep charcoal ink `#1C1917`, restrained electric cobalt `#2941E8`, controlled lime `#A3D418` (value/verified highlights only), soft warm surface `#F3F1EC`, hairline `#E5E1D8`.
- **Type.** Bricolage Grotesque (display: heroes, section titles — opinionated, slightly compressed at large sizes) + Inter Tight (body and UI — tight, legible, modern). No serif body, no monospace labels.
- **Layout.** Left-aligned editorial grid, 12-column with intentional asymmetry (7/5 splits), max-width 1200px, wide gutters. Product cards are quiet; photography is large.
- **Principles.** 1) The recommendation reasoning is the product — always visible, never hidden in tooltips. 2) One bold thing per page (usually the hero statement). 3) Verified data gets the lime tick; AI explanations are visually distinct from verified specs. 4) Motion answers actions: press states, expand/collapse, step transitions — not ambient floating.

## Tokens

Defined as CSS custom properties in `src/app/globals.css` under `@theme inline` (Tailwind 4). Hardcoded values in components are not allowed — use tokens.

### Color

| Token | Value | Use |
| --- | --- | --- |
| `--color-paper` | `#FAF9F6` | Page background (warm off-white) |
| `--color-surface` | `#FFFFFF` | Cards, panels |
| `--color-surface-warm` | `#F3F1EC` | Tinted sections, answer bars |
| `--color-ink` | `#1C1917` | Primary text (deep charcoal) |
| `--color-muted` | `#57534E` | Secondary text |
| `--color-faint` | `#A8A29E` | Tertiary text, placeholders |
| `--color-line` | `#E5E1D8` | Hairlines, borders |
| `--color-line-strong` | `#D6D0C4` | Emphasised borders |
| `--color-cobalt` | `#2941E8` | Primary accent — CTAs, links, focus |
| `--color-cobalt-deep` | `#1F33BE` | Cobalt hover |
| `--color-cobalt-soft` | `#EEF0FE` | Cobalt tinted backgrounds |
| `--color-lime` | `#A3D418` | Value/verified indicator (sparing) |
| `--color-lime-soft` | `#F2F8DE` | Lime tinted backgrounds |
| `--color-lime-ink` | `#4A5B0E` | Text on lime-soft (contrast-safe) |
| `--color-danger` | `#B3261E` | Errors, destructive |

Contrast checks: ink on paper 15.6:1; muted on paper 7.4:1; cobalt on paper 6.9:1; white on cobalt 6.1:1; lime-ink on lime-soft 8.2:1. Lime is never used as text on light backgrounds.

### Typography

| Role | Family | Weight | Notes |
| --- | --- | --- | --- |
| Display | Bricolage Grotesque | 600–700 | tracking -0.02em to -0.03em; clamp() scales, no fixed hero sizes |
| Body / UI | Inter Tight | 400–600 | 16px base, 1.6 line-height, max 72ch measure |

Scale: 12 (caption) / 14 (small) / 16 (body) / 18 (lead) / 24 (h3) / 32 (h2) / 44 (h1) / 56–72 (hero, clamp).

### Spacing & radii

- Space scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128 (Tailwind default steps).
- Radii: `--radius-sm` 6px (inputs, small badges), `--radius-md` 10px (buttons, cards), `--radius-lg` 16px (panels, media). No pill-shaped buttons; pills only for status badges.
- Shadows are rare: `--shadow-card` for raised product cards only. Depth is mostly expressed by surface + hairline.

### Motion

- Durations: 120ms press feedback, 200ms hover, 300ms panel/step transitions.
- Easing: `--ease-out` (cubic-bezier(0.22, 1, 0.36, 1)) for entrances; `--ease-in` for exits.
- Only `transform` and `opacity` animate. `prefers-reduced-motion` disables non-essential motion globally.
- Buttons compress `scale(0.97)` on `:active`. No floating ambient loops.

## Component conventions

- Buttons: cobalt solid (primary), charcoal outline (secondary), text+arrow (tertiary). Min height 44px, cursor-pointer, visible focus ring (2px cobalt, offset 2px).
- Product cards: surface on paper, 1px line border, image top with fixed aspect ratio (4:3), verified-price row with lime tick, reasoning line in muted text.
- Answer bar: `surface-warm` panel with a cobalt left rule; holds "why this was recommended" reasoning.
- Verified vs AI: verified data rows carry a small lime check; AI-generated explanation blocks are prefixed "Assistant notes" and never contain specs/prices.
- Empty states: one sentence + one action. No illustration spam.

## Accessibility floor

- 4.5:1 text contrast minimum; visible keyboard focus everywhere; full keyboard operability for the assistant steps; `aria-live` for recommendation results; alt text on all product photos; skip link; semantic landmarks; no horizontal scroll at 375px.
