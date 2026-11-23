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
    api/recommend              POST — scored recommendations (+ optional Groq explanation)
    api/setup-build            POST — budget-split setup builder
    api/go                     GET  — validated affiliate redirect + click log
    api/products/3d-model      POST — enqueue one 3D generation (shared secret)
    api/products/3d-model/status GET — job/queue state for one product
    api/n8n/admitad/*          workflow routes: status, preview, import,
                               deeplink, aliexpress, enrich
  components/          UI (server by default, "use client" only where needed)
  lib/
    types.ts           shared domain types
    site.ts            brand config (single source of truth)
    catalogue.ts       synchronous seed data + formatPrice (build-safe)
    catalogue-server.ts server catalogue: seed + approved Supabase rows,
                        merged; reads the public `catalogue_products` view
    currency.ts        ISO 4217 validation + formatting helpers
    recommendation-engine.ts   deterministic scoring + setup builder
    ai/provider.ts     AI abstraction — explanations only, never facts
    ai/groq.ts         Groq adapter (OpenAI-compatible endpoint)
    ai/freellmapi.ts   FreeLLMAPI adapter — optional categorisation only
    supabase-rest.ts   PostgREST wrapper for the catalogue + import pipeline
    supabase-server.ts PostgREST wrapper for the 3D queue (service role)
    model-store.ts     model state reads + generation queue
    glb.ts             structural GLB validation (pure, testable)
    affiliate.ts       URL validation + non-identifying click logging
    admitad/           Admitad client, mapper, feed parser, importer,
                       permissions (feed gate), provenance store
    rate-limit.ts      in-memory token bucket (10 req/60s/IP/route)
    validation.ts      input parsing bounds
    workflow-auth.ts   shared-secret auth for /api/n8n routes
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

1. Client components read the synchronous seed catalogue from
   `catalogue.ts`. Server pages (`/discover`, `/products/[slug]`) call
   `getCatalogueSnapshot()`, which merges approved Supabase rows with the
   seed list and degrades to seed-only when credentials are absent or the
   read fails.
2. Catalogue reads go through the `catalogue_products` **view**, not the base
   table. The view is limited to approved rows and to customer-facing
   columns: research fields, `model_error` and `commission_info` (signed feed
   provenance) are absent, and `anon`/`authenticated` hold no privilege on
   `affiliate_products` itself.
3. Ordering is `last_synced_at desc, created_at desc` — deliberately not
   `updated_at`, which the import guard and 3D worker both bump, so a model
   completion cannot reorder the storefront.
4. Recommendations are computed per-request on the server; rate limited per
   IP per route.
5. Outbound purchase clicks go through `/api/go`, which validates the
   destination against the approved programme domain before issuing a 302
   with `no-store` and no referrer.

## Admitad integration

The importer is a workflow route (`POST /api/n8n/admitad/import`) protected
by `N8N_WEBHOOK_SECRET`. It fails closed on two independent checks:

- **Permission.** `show_products_links` must be `true` and the connection
  active. A feed URL that downloads successfully is *not* evidence of
  permission; a signed link returning HTTP 200 is ignored when the advertiser
  has not enabled product links.
- **Credentials.** Without them the route reports exactly what is missing
  rather than falling back to an unauthenticated scrape.

Imports upsert on `(source, advertiser_id, external_product_id)`, never claim
a `data_source = 'manual'` row (enforced by a `BEFORE UPDATE` guard trigger),
and keep AI copy in its own `ai_*` columns. The original feed URL is stored
only in `commission_info` on the base table.

## Admin

There is **no `/admin` route in this codebase**. Catalogue writes happen
through the workflow API (`/api/n8n/admitad/*`), which is gated by
`N8N_WEBHOOK_SECRET`, and through direct service-role operations. Approval
state lives in `affiliate_products.approval_status` and only approved rows
are reachable through the public view.

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
