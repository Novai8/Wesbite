# Fyndra — Design System

Fyndra is the working brand for this platform (centralised in `src/lib/site.ts`, swappable in one place). The visual direction: **editorial commerce meets AI-powered product discovery** — a premium product research publication crossed with an intelligent shopping assistant.

## Design plan (decided, then built)

- **Concept.** A research publication that answers shopping questions. Content-first grids, real product photography, generous whitespace, and one signature element: the **answer bar** — a warm-tinted panel framing every recommendation with its reasoning, like an annotated research note.
- **Homepage.** A saturated blue scroll story anchored by a centred `Fyndra` wordmark and four editorial rooms. The hero copy is typographic, and a cursor-following 3D shopping cart is layered over it as the page's one motion element (see *The cursor cart* below). The catalogue is an Airflex-inspired editorial grid; product pages use a quieter Mushroom-style media/detail split.
- **Color.** Warm off-white paper `#FAF9F6`, deep charcoal ink `#1C1917`, restrained electric cobalt `#2941E8`, controlled lime `#A3D418` (value/verified highlights only), soft warm surface `#F3F1EC`, hairline `#E5E1D8`.
- **Type.** Bricolage Grotesque (display: heroes, section titles — opinionated, slightly compressed at large sizes) + Inter Tight (body and UI — tight, legible, modern). No serif body, no monospace labels.
- **Layout.** Left-aligned editorial grid, 12-column with intentional asymmetry (7/5 splits), max-width 1200px, wide gutters. Product cards are quiet; photography is large.
- **Principles.** 1) The recommendation reasoning is the product — always visible, never hidden in tooltips. 2) One bold thing per page (usually the hero statement). 3) Verified data gets the lime tick; AI explanations are visually distinct from verified specs. 4) Motion answers actions: press states, expand/collapse, step transitions — not ambient floating. 5) One deliberate exception: the homepage cursor cart, a single element that follows the pointer and lays tyre prints. It is the only ambient motion in the product.

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
- Buttons compress `scale(0.97)` on `:active`. No floating ambient loops — with one exception: the cursor cart described below. It is a WebGL canvas, so its motion is outside the CSS transform/opacity rule; it is still gated by `prefers-reduced-motion`, which swaps it for a single parked frame.

## The cursor cart

The homepage hero carries one 3D element: a shopping cart that follows the pointer and leaves a pair of tyre prints in its wake. It is decorative and correctly hidden from assistive tech (`aria-hidden`), never a control.

- **Mount points.** `src/app/page.tsx` renders `<CartExperience />` alongside `<LandingHero />`. `src/components/cart-experience/cart-experience.tsx` is the gate: it checks `prefers-reduced-motion` and WebGL support, skips devices reporting `deviceMemory <= 2`, and only then lazily loads the stage during an idle window.
- **Stage.** `src/components/cart-experience/cart-stage.tsx` owns the React Three Fiber canvas, an orthographic near-top-down camera, and the per-frame motion. It is a fixed overlay with `pointer-events: none`, so links and buttons underneath stay fully clickable.
- **Model.** `cart-model.ts` rebuilds the supplied OBJ into a small scene graph and reparents the four existing wheel meshes into axle pivots so they can roll and steer. Footprint constants come straight from the model, so shadows and prints are sized from real geometry rather than eyeballed.
- **Motion.** `src/lib/cart-motion.ts` holds the pure, unit-tested spring and heading maths. The cart eases toward the pointer, banks into lateral movement, and rolls its wheels by the distance actually travelled.
- **Shadow.** `cart-shadow.tsx` draws a wide ambient wash, a darker cast, and one contact patch per tyre, all as radial-shader quads — no shadow map, no render target. `src/lib/cart-shadow.ts` holds the motion response curve.
- **Tyre prints.** `trail-buffer.ts` writes a bounded ribbon (220 points desktop, 120 mobile) and `trail-mesh.tsx` streams it into one reusable geometry, so driving allocates nothing.
- **Fallbacks.** Reduced motion parks the cart as a single static frame. Without WebGL the canvas never mounts. Either way the hero reads as designed, because the cart is decoration over a complete typographic layout.

## Component conventions

- Buttons: cobalt solid (primary), charcoal outline (secondary), text+arrow (tertiary). Min height 44px, cursor-pointer, visible focus ring (2px cobalt, offset 2px).
- Product cards: surface on paper, 1px line border, image top with fixed aspect ratio (4:3), verified-price row with lime tick, reasoning line in muted text.
- Answer bar: `surface-warm` panel with a cobalt left rule; holds "why this was recommended" reasoning.
- Verified vs AI: verified data rows carry a small lime check; AI-generated explanation blocks are prefixed "Assistant notes" and never contain specs/prices.
- Empty states: one sentence + one action. No illustration spam.

## Accessibility floor

- 4.5:1 text contrast minimum; visible keyboard focus everywhere; full keyboard operability for the assistant steps; `aria-live` for recommendation results; alt text on all product photos; skip link; semantic landmarks; no horizontal scroll at 375px.
