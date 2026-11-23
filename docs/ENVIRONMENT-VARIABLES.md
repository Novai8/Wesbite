# Environment Variables

All optional except where noted. The app runs fully without any credentials —
every integration degrades gracefully and says so rather than pretending.

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | recommended | build | Canonical site URL for metadata/sitemap. Defaults to `http://localhost:3000`. |
| `GROQ_API_KEY` | optional | server only | Enables the Groq explanation layer (`/api/recommend`). Without it, explanations are generated deterministically. |
| `SUPABASE_URL` | optional | server only | Enables the Supabase catalogue layer. Without it, the seed catalogue is used. |
| `SUPABASE_ANON_KEY` | optional | server only | Keyed access matching RLS policies for anon. |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | server only | Bypasses RLS for admin write paths. **Never** exposed to the browser; never logged; never committed. |
| `N8N_WEBHOOK_SECRET` | optional | server only | Shared secret for n8n workflow callbacks. When unset, workflow endpoints refuse all traffic (fail closed). |
| `ADMIN_PASSWORD` or Supabase Auth | optional | server only | Gate for `/admin`. Without it, `/admin` is unreachable and says so. |
| `FYNDRA_3D_WORKER_SECRET` | optional | server only | Enables `POST /api/products/3d-model` and the status route. When unset both refuse all traffic (503). Must be sent as `Authorization: Bearer …`. |
| `HF_TOKEN` | optional | worker only | Hugging Face token for the ZeroGPU worker. Falls back to the `hf` CLI login. Never read by the Next.js app. |
| `FREELLMAPI_API_KEY` | optional | server only | FreeLLMAPI key for optional product categorisation. Absent or exhausted vision routing degrades to the deterministic catalogue data. |
| `FREELLMAPI_BASE_URL` | optional | server only | FreeLLMAPI gateway base URL. Defaults to `http://127.0.0.1:31415/v1`. A remote deployment needs a reachable, authenticated endpoint. |

### Admitad

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `ADMITAD_CLIENT_ID` | for Admitad | server only | OAuth client id from store.admitad.com → Settings → Credentials. |
| `ADMITAD_CLIENT_SECRET` | for Admitad | server only | OAuth client secret. **Never** in a `NEXT_PUBLIC_` variable. |
| `ADMITAD_WEBSITE_ID` | for Admitad | server only | Publisher ad-space id. Needed for programme listing, deeplinks and AliExpress availability checks. |
| `ADMITAD_CAMPAIGN_ID` | optional | server only | Default advertiser programme to import. Import routes also accept `campaignId` per request. |
| `ADMITAD_ACCESS_TOKEN` | optional | server only | Pre-obtained bearer token. Used verbatim and **not refreshed**; prefer the client credentials. |
| `ADMITAD_SCOPE` | optional | server only | Space- or comma-separated scopes. Defaults to the documented publisher set. |
| `ADMITAD_FEED_URL` | optional | server only | Pinned feed download link instead of resolving it from the programme object. |

`ADMITAD_ACCOUNT_ID` is **not** used: no endpoint in this integration needs it.
The access token is derived by OAuth, so it is not required either.

`ADMITAD_FEED_URL` is a signed, advertiser-controlled URL. Feed URLs are never
logged, never returned to the browser and never stored in a public column — the
original feed URL is kept only in the internal `commission_info` provenance on
the base table, which the public `catalogue_products` view does not project.

The importer additionally fails closed unless the advertiser has enabled
product links (`show_products_links: true`). A feed that downloads successfully
is not evidence of permission. See `docs/ADMITAD-INTEGRATION.md` for the
connection walkthrough.

### Supabase (as used by the catalogue)

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `SUPABASE_URL` | for storage | server only | Project URL. Without it the seed catalogue is served. |
| `SUPABASE_SERVICE_ROLE_KEY` | for storage | server only | Used by the import pipeline, catalogue reads and the 3D worker's writes. Bypasses RLS — server only, never logged. |
| `SUPABASE_ANON_KEY` | optional | server only | Present for completeness; the current server reads use the service role. |

## Rules

- Variables prefixed `NEXT_PUBLIC_` are inlined into the client bundle —
  only ever used for non-sensitive values.
- Any key ending in `SERVICE_ROLE_KEY`, `API_KEY` or `SECRET` stays
  server-side. No `process.env` reference to them may appear in a
  `"use client"` module.
- `.env*` files are git-ignored. Documented here, never committed.
- Missing credentials are reported honestly: the UI shows the fallback
  behaviour (deterministic explanations, seed catalogue) and the docs
  describe how to enable the integration. The app never fabricates a
  "connected" state.

## 3D agent credentials

The 3D agent adds two independent trust boundaries, and neither one is ever
shipped to the browser:

- **Hugging Face** — used only by `scripts/3d_worker.py`, on the machine
  that runs the worker. The token stays in the environment or the `hf` CLI
  credential cache and is never logged.
- **Supabase** — `SUPABASE_SERVICE_ROLE_KEY` is read only by server modules
  (`src/lib/supabase-server.ts`). It is never referenced from a `"use client"`
  module.

If `FYNDRA_3D_WORKER_SECRET` is unset, the enqueue and status routes return
`503` rather than exposing an open generation trigger that could burn the
free GPU quota.
