# Architecture

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript strict
- **Tailwind CSS 4** — design tokens in `src/app/globals.css` via
  `@theme inline`; no tailwind.config
- **Hosting**: Cloudflare Workers via `@opennextjs/cloudflare`
  (`wrangler.jsonc`, `open-next.config.ts`) — preserved from the original
  repo, not modified
- **Fonts**: Bricolage Grotesque (display) + Inter Tight (body) via
  `next/font/google`

## Layered design

```
src/
  app/                 pages + API routes
    api/recommend      POST — scored recommendations (+ optional Groq explanation)
    api/setup-build    POST — budget-split setup builder
    api/go             GET  — validated affiliate redirect
  components/          UI (server by default, "use client" only where needed)
  lib/
    types.ts           shared domain types
    site.ts            brand config (single source of truth)
    catalogue.ts       data access layer (seed ⇄ Supabase swap point)
    recommendation-engine.ts   deterministic scoring + setup builder
    ai/provider.ts     AI abstraction — explanations only, never facts
    ai/groq.ts         Groq adapter (OpenAI-compatible endpoint)
    affiliate.ts       URL validation + non-identifying click logging
    rate-limit.ts      in-memory token bucket (10 req/60s/IP/route)
    validation.ts      input parsing bounds
  data/
    seed-products.ts   seed catalogue (labelled as sample data)
```

## The AI boundary

The scoring engine (`recommendation-engine.ts`) is deterministic: the same
inputs always produce the same scores. AI exists in exactly one place —
rewriting the human-facing explanation text — and is structurally unable to
alter scores, products, prices or specs. When `GROQ_API_KEY` is unset, the
deterministic explanation is used and `generatedBy` says so.

## Data flow

1. All catalogue reads go through `catalogue.ts`, currently backed by the
   seed data. When Supabase credentials exist, the same functions read from
   `affiliate_products` (RLS-governed).
2. Recommendations are computed per-request on the server; rate limited per
   IP per route.
3. Outbound purchase clicks go through `/api/go`, which validates the
   destination against the approved programme domain before issuing a 302
   with `no-store` and no referrer.

## Admin

`/admin` is a protected dashboard for catalogue management (CRUD, CSV/JSON
import, approval, price freshness, click stats). Access requires admin
auth; without credentials configured the dashboard is unreachable and says
so.

## Constraints honoured

- 8 GB RAM / Intel UHD 620: no WebGL, no 3D, static-first pages, lazy
  images, minimal client JS. Animations are transform/opacity only.
- The wrangler/OpenNext deployment config is untouched; the app builds to
  `.open-next/worker.js` unchanged.
