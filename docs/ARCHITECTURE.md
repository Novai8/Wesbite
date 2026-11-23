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
    ai/freellmapi.ts   FreeLLMAPI adapter — optional categorisation only
    supabase-server.ts PostgREST + Storage wrapper (service role, server only)
    model-store.ts     model state reads + generation queue
    glb.ts             structural GLB validation (pure, testable)
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

## 3D product models

Generated models come from **remote** inference only: the worker in
`scripts/3d_worker.py` calls the public Hugging Face Space
`stabilityai/stable-fast-3d` over its Gradio API, on ZeroGPU hardware.
Nothing is inferred on this machine — no weights are downloaded, no local GPU
or CPU model runs, and the browser only displays a finished GLB.

```
POST /api/products/3d-model   enqueue one product (shared-secret)
        │
        ▼
product_model_jobs            pending → processing → completed | failed | quota_exhausted
        │                     unique (product_id, source_image_hash)
        ▼
scripts/3d_worker.py          HF Gradio API → validate GLB → Supabase Storage
        │
        ▼
affiliate_products.model_*    read once per cached page render
        │
        ▼
Product3dStage                lazy Three.js island, image fallback
```

Rules the code enforces:

- Page views never trigger generation; the product page only *reads* cached
  model state (`revalidate: 60`).
- Jobs dedupe on product ID **and** image hash, so the same photo is modelled
  once. A completed model is returned instead of a new job.
- A `quota_exhausted` job is terminal for the day: the worker stops instead of
  retrying and burning more quota.
- SVG placeholders are rejected; only raster photos are generatable.
- Bulk enqueue is not implemented. One image at a time until proven.

## Constraints honoured

- 8 GB RAM / Intel UHD 620: no local model inference and no local GPU
  dependency. Pages stay static-first with lazy images and minimal client JS.
  Animations remain transform/opacity based.
- The one WebGL exception is the product 3D stage: a narrow `"use client"`
  island that dynamically imports Three.js only when a completed model exists,
  pauses when offscreen, disposes GPU resources on unmount, and falls back to
  the original product photo when WebGL is unavailable, the GLB fails to load,
  or the visitor prefers reduced motion.
- The wrangler/OpenNext deployment config is untouched; the app builds to
  `.open-next/worker.js` unchanged.
