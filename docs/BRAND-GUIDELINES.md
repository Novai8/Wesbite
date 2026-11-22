# Fyndra Brand Guidelines

## Brand

- **Name:** Fyndra
- **Pronunciation:** FIN-dra
- **From:** "find" — discovery, locating the right thing
- **Positioning:** Search by problem, not by product. Fyndra is an AI-powered shopping discovery engine: visitors describe what they need, set a budget, and receive products selected around their actual requirements, with transparent reasoning.
- **Voice:** Plain, specific, honest. A knowledgeable friend who explains their reasoning and admits limits. Never salesy, never hype. Sentence case everywhere.
  - Say: "Here's why this made the list", "Prices verified 12 May", "We couldn't find anything under $40 for this — here's the closest".
  - Don't say: "unbeatable deals", "game-changing", "100% satisfied customers".
- **Honesty rules:** Never fabricate prices, availability, specs, reviews or testimonials. Verified data is marked; AI-written explanations never contain product facts. Affiliate relationships are disclosed plainly.

## Logo

The wordmark is set in Bricolage Grotesque 700, lowercase "fyndra", charcoal, with the "y" descender in cobalt. The mark is a locator glyph: a rounded square with a cobalt dot offset toward the top-right — "found".

- Source files: `public/brand/` (SVG primary, PNG raster fallback)
- Favicon / app icons generated into `src/app/icon.png` and `apple-icon.png`
- Clear space: 0.5× the mark's height on all sides. Minimum size: 24px height.
- Do not: recolour the wordmark, place the mark on busy photography without a scrim, stretch or italicise.

## Color usage rules

1. **Paper is the product.** Most of every page is warm off-white. Sections may alternate `paper` and `surface-warm`; pure white is for cards only.
2. **Cobalt is directional.** It marks where the visitor acts: primary buttons, active steps, links, focus rings. Never as a background wash behind paragraphs.
3. **Lime is a signal, not a decoration.** Only for verified/value indicators: the price-verified tick, "best value" markers, in-budget confirmations. Max one lime element per viewport.
4. **Charcoal does the talking.** Headlines and body are ink; hierarchy comes from size and weight, not color.
5. Photography: real product photos on neutral or in-context backgrounds. No stock lifestyle clichés, no heavy filters.

## Typography rules

- Bricolage Grotesque for headlines only. Never set body text in it.
- Inter Tight for body, UI labels, buttons, forms.
- No all-caps eyebrows, no letter-spaced labels, no decorative middots. Section rhythm comes from size jumps and whitespace.
- Numbers (prices, budgets) use tabular figures (`font-variant-numeric: tabular-nums`).

## Layout & motion rules

- 12-column grid, max 1200px, left-aligned. Hero sections may break the grid deliberately (7/5 split with the assistant preview offset).
- Motion budget per page: the homepage hero is the one ambient/scroll moment (3D cart stage); elsewhere one entrance moment (hero), plus interaction feedback (press, expand, step change). Nothing loops. Nothing floats.
- Durations and easings are fixed by `DESIGN.md` — do not invent new ones per component.

## Affiliate disclosure voice

Disclosure is part of the brand, not legal fine print to hide. Standard line:

> "Links marked **Affiliate** earn us a commission if you buy something. It doesn't change what we recommend or what you pay. How we make money →"

Every recommendation surface shows it once, visibly.
