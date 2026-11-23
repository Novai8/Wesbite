# 3D Agent

Turns a product photo into a textured GLB using **free remote GPU** only, then
serves it from Supabase Storage.

## Pipeline

1. `POST /api/products/3d-model` with `{ productId, imageUrl }` and the worker
   secret. The route hashes the image, dedupes, and inserts one
   `product_model_jobs` row.
2. `python scripts/3d_worker.py --limit 1` claims the oldest pending job.
3. The worker downloads the photo, verifies its SHA-256 still matches, and
   calls the public Space `stabilityai/stable-fast-3d` over Gradio.
4. The returned GLB is downloaded immediately (Space outputs are temporary),
   validated structurally, uploaded to the `product-models` bucket, and the
   product row is updated.
5. The product page reads the cached model state and mounts the viewer.

## Provider

| | |
| --- | --- |
| Space | `stabilityai/stable-fast-3d` (public, ZeroGPU `zero-a10g`) |
| Model | Stability AI Stable Fast 3D (`stabilityai/stable-fast-3d`) |
| Licence | Stability AI Community License — free commercial use **only** below US $1M annual revenue; an enterprise licence is required above that |
| Cost | $0 — uses the Hugging Face daily free GPU quota |

No paid fallback (Meshy, Tripo, Replicate) is configured anywhere. If the Space
is unavailable, the job fails and the product keeps its photo. TripoSR is a
possible substitute but produces untextured geometry, which is a visible
quality drop, so it is not wired in.

### Live API contract

`view_api()` advertises five parameters on `/run_button`, but the dependency is
actually wired to seven inputs. The working call is:

```python
client.predict("Run", handle_file(image), None, 0.85, "None", -1, 1024,
               api_name="/run_button")
```

`/requires_bg_remove` must be called first on the same client to prime the
Space's background-removal state, and the client must be constructed with
`_skip_components=False`. Omitting any of these raises `AppError`.

## Commands

```bash
# Prove the remote path with one image (no database needed)
python scripts/3d_worker.py --image photo.png

# Process one queued job (gradual by design)
python scripts/3d_worker.py --limit 1

# Validate a GLB with the same parser the worker uses
node scripts/check-glb.mjs path/to/model.glb

# Check remaining free GPU quota
hf spaces zero-gpu quota --format json
```

## States

`pending` → `processing` → `completed`

Terminal failures: `failed`, `quota_exhausted`, `image_fallback`.

`quota_exhausted` is set when the Space reports a 429 / ZeroGPU / quota error.
The worker stops and leaves remaining jobs `pending` for the next quota window
instead of retrying.

## Guardrails

- Generation is never triggered by a page view.
- Jobs are unique on `(product_id, source_image_hash)`.
- A completed model is never regenerated for the same image.
- The source image is re-hashed before generation, so a changed product photo
  cannot silently produce a model of a different item.
- Only raster photos are accepted; SVG placeholders are rejected with `422`.
- Bulk catalogues are not supported until the single-image flow is proven.
- HF, FreeLLMAPI, and Supabase secrets stay server-side and are never logged.
- The queue's `updated_at` is stamped by a database trigger, so every worker
  and API write advances it without the caller sending the column.
- `productId` must be the `affiliate_products` UUID. Catalogue slugs such as
  `p-monitor-arm-gas` are rejected with `400`; an unknown UUID is a `404`.

## Storage

`product-models` is a public bucket: product pages fetch GLBs straight from it,
so no `storage.objects` SELECT policy is needed (and the older redundant one is
dropped by the migration). No INSERT/UPDATE/DELETE policy exists for `anon` or
`authenticated`; `scripts/3d_worker.py` uploads with the service-role key and
never logs it.

## Tests

```bash
npm test        # TypeScript route + validation + Python worker/migration
npm run test:unit
npm run test:py
```

`tests/test_persistence.py` runs the trigger against a throwaway Postgres
container and skips automatically when no Docker daemon is reachable
(normally the case, given the migration must not be applied anywhere).

## Viewer

`src/components/product-3d-stage.tsx` is the only client component involved.
It renders a matte-black stage with a circular platform and a white spotlight,
floats and rotates the model, and supports drag-to-rotate plus wheel/pinch
zoom. Three.js is imported dynamically. The original product photo is the
fallback whenever the model state is not `completed`, loading fails, or WebGL
is unavailable.

## Enabling it

1. Apply `supabase/migrations/20261123150000_fyndra_3d_models.sql`.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `FYNDRA_3D_WORKER_SECRET` in the server environment.
3. Log in once with `hf auth login` (or set `HF_TOKEN` for the worker host).
4. Enqueue a single product and run the worker with `--limit 1`.
