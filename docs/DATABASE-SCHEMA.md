# Database Schema

Fyndra uses Supabase (PostgreSQL) for persistent storage. The seed catalogue
in `src/data/seed-products.ts` mirrors these tables so the app runs fully
without credentials — the Supabase layer swaps in when configured.

## Rules

1. **Never reset or drop existing tables.** All migrations are additive
   (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`).
2. The service-role key lives server-side only and is never referenced by
   any client code path. Browser code can only touch tables through RLS-
   governed anon access or via server API routes.
3. Row Level Security is enabled on every table. No table is left public.

## Tables

### affiliate_products

The core catalogue. One row per product.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk default gen_random_uuid() | |
| slug | text unique not null | URL identifier |
| title | text not null | |
| description | text not null | |
| category_slug | text not null references affiliate_categories(slug) | |
| subcategory | text | |
| image_urls | jsonb default '[]' | array of URLs |
| merchant | text not null | |
| program_slug | text not null references affiliate_programs(slug) | |
| affiliate_url | text not null | validated against programme domain |
| source_url | text | public listing the data came from |
| price | numeric(10,2) not null check (price >= 0) | |
| currency | text not null default 'USD' | ISO 4217 code; flexible three-letter validation, not a fixed list | |
| previous_price | numeric(10,2) | for was/now display |
| specs | jsonb default '{}' | key/value spec pairs |
| pros | jsonb default '[]' | |
| cons | jsonb default '[]' | |
| availability | text not null default 'unknown' check in (in_stock, out_of_stock, unknown) | |
| region | jsonb default '[]' | ISO country codes |
| keywords | jsonb default '[]' | matching tokens for the engine |
| use_cases | jsonb default '[]' | problems this solves |
| budget_tier | text not null default 'budget' check in (budget, mid, premium) | |
| price_verified_at | timestamptz | last price check |
| approval_status | text not null default 'pending' check in (approved, pending, rejected) | |
| data_source | text not null default 'manual' check in (manual, api, csv_import, n8n_workflow) | |
| source | text | `admitad` / `aliexpress` / null for curation |
| external_product_id | text | advertiser's own id, with `advertiser_id`, forms the import identity |
| advertiser_id | text | advertiser/programme id from the network |
| commission_info | jsonb | internal provenance: advertiser, programme, original feed URL, and the category provenance (`sourceCategoryId`, `sourceCategory`, `categoryBasis`). Never in the public view. |
| last_synced_at | timestamptz | when the source data last changed; catalogue ordering key |
| ai_headline / ai_description / ai_quality_flags | text / text / jsonb | generated copy, kept in their own columns so a re-sync cannot clobber them |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |
| model_url | text | public URL of the generated GLB; set only when `model_status = 'completed'` |
| model_format | text | `glb` |
| model_type | text | `single_image_generative` or `manual` |
| model_status | text | `pending`, `processing`, `completed`, `failed`, `quota_exhausted`, `image_fallback`, or null |
| model_provider | text | e.g. `huggingface:stabilityai/stable-fast-3d` |
| model_generated_at | timestamptz | when the GLB was produced |
| model_error | text | human-readable failure reason; never contains credentials |
| source_image_hash | text | SHA-256 of the source photo; used to dedupe generation |

The `model_*` and `source_image_hash` columns are added by
`supabase/migrations/20261123150000_fyndra_3d_models.sql` with
`ADD COLUMN IF NOT EXISTS`, so the migration is safe on an existing catalogue.

#### Currency

`currency` holds an ISO 4217 three-letter code (`USD`, `EUR`, `GBP`, `AED`,
`PKR`, `JPY`, `INR`, …). Validation is a format check plus a known-code table
(`src/lib/currency.ts`), not a column constraint listing three values, so a new
advertiser currency does not need a migration. Display uses
`Intl.NumberFormat` with the real code and never silently re-labels an unknown
currency as USD.

#### Access

RLS is enabled with `products_read_approved` (approved rows only). Column-level
security is enforced by **not granting** `anon`/`authenticated` any privilege on
this table:

- `revoke all on public.affiliate_products from anon, authenticated`
- public reads go through the `catalogue_products` view below
- `insert`/`update`/`delete` remain `service_role` only

#### catalogue_products (view)

Customer-facing projection of approved rows. A `security_barrier` view owned by
`postgres`, readable by `anon` and `authenticated`. It exists because RLS is
row-level only: without it, an approved row would expose every column.

Deliberately **absent** from the view:

| Column | Why |
| --- | --- |
| `evidence_notes`, `score`, `research_confidence`, `decision` | internal research output |
| `model_error` | operator-facing 3D failure detail |
| `commission_info` | internal provenance; contains signed advertiser feed URLs |

`created_at`, `updated_at`, `last_synced_at`, `advertiser_id`,
`external_product_id` and the display-only `model_*` fields are included.
Catalogue reads in the app use `fromPublicProductRow()`, which never reads
`commission_info`; privileged reads of the base table use `fromProductRow()`.

### product_model_jobs

The 3D generation queue. One row per (product, source image), which is what
deduplication keys on.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk default gen_random_uuid() | |
| product_id | uuid not null references affiliate_products(id) on delete cascade | |
| source_image_hash | text not null | SHA-256 of the source image |
| source_image_url | text not null | what the worker re-fetches and re-hashes |
| status | text not null default 'pending' | same union as `model_status` |
| attempts | int not null default 0 | incremented when a worker claims the job |
| provider | text | `huggingface:stabilityai/stable-fast-3d` |
| model_path | text | object path inside the `product-models` bucket |
| error | text | last failure reason |
| created_at / updated_at | timestamptz | |

`unique (product_id, source_image_hash)` — re-enqueuing the same image is a
no-op. Indexed on `(status, created_at)` so claiming the oldest pending job is
cheap. RLS is enabled with **no** policies: only `service_role` touches it.

`updated_at` is owned by a `BEFORE UPDATE` trigger
(`product_model_jobs_set_updated_at` → `set_product_model_jobs_updated_at()`),
which stamps `now()` on every row change. Callers never send the column, so a
worker PATCH that only flips `status` still advances the timestamp.

### Storage: product-models

Public-read bucket holding generated GLBs at
`<product_id>/<first 16 chars of source_image_hash>.glb`. 25 MB limit,
`model/gltf-binary` only. Public read so product pages can load the file
directly; writes are `service_role` only.

### affiliate_categories

| Column | Type |
| --- | --- |
| slug | text pk |
| name | text not null |
| description | text not null |
| icon | text not null default 'Package' |
| sort_order | int default 0 |

RLS: `select` for `anon`; writes for `service_role`.

### affiliate_programs

| Column | Type | Notes |
| --- | --- | --- |
| slug | text pk | |
| name | text not null | |
| network | text not null | e.g. AliExpress Portals |
| destination_domain | text not null | the only allowed outbound host |
| active | boolean not null default true | |
| commission_note | text | never machine-generated figures |

RLS: `select` for `anon` (active rows only); writes for `service_role`.

### product_sources

Provenance for every product record: where the data came from and when.

| Column | Type |
| --- | --- |
| id | uuid pk |
| product_id | uuid references affiliate_products(id) on delete cascade |
| source_type | text not null (manual / listing_fetch / csv / workflow) |
| source_url | text |
| fetched_at | timestamptz default now() |
| notes | text |

RLS: `service_role` only.

### product_price_history

Append-only price log for freshness scoring and price-change display.

| Column | Type |
| --- | --- |
| id | uuid pk |
| product_id | uuid references affiliate_products(id) on delete cascade |
| price | numeric(10,2) not null |
| currency | text not null |
| recorded_at | timestamptz default now() |
| source | text (manual / workflow / api) |

RLS: `service_role` only. Insert-only by design — never update rows.

### affiliate_clicks

Non-identifying outbound click log.

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | |
| product_id | uuid references affiliate_products(id) | |
| program_slug | text not null | |
| merchant | text | |
| campaign | text | internal source label (product-page, compare…) |
| ts | timestamptz default now() | |

**Deliberately excluded:** IP addresses, user agents, session ids, cookies —
nothing that could identify a visitor. RLS: `service_role` only.

### shopping_sessions

Aggregate, non-identifying record of assistant interactions.

| Column | Type |
| --- | --- |
| id | uuid pk |
| mode | text (assistant / setup-builder / problem-solver / discover) |
| goal_text | text (the user's typed description) |
| budget | numeric(10,2) |
| currency | text |
| preferences | jsonb |
| created_at | timestamptz default now() |

No user identifiers. RLS: `service_role` only.

### shopping_recommendations

What the engine returned for a session.

| Column | Type |
| --- | --- |
| id | uuid pk |
| session_id | uuid references shopping_sessions(id) on delete cascade |
| primary_product_id | uuid references affiliate_products(id) |
| alternative_product_ids | jsonb default '[]' |
| score_breakdown | jsonb |
| generated_by | text (deterministic / groq) |
| created_at | timestamptz default now() |

RLS: `service_role` only.

### product_comparisons

Aggregate record of compare-page usage.

| Column | Type |
| --- | --- |
| id | uuid pk |
| product_ids | jsonb not null (2–3 uuids) |
| created_at | timestamptz default now() |

RLS: `service_role` only.

### content_guides

Editorial content with an explicit draft → published lifecycle.

| Column | Type |
| --- | --- |
| id | uuid pk |
| slug | text unique not null |
| title | text not null |
| excerpt | text |
| body | text not null |
| status | text not null default 'draft' check in (draft, published) |
| created_at / updated_at | timestamptz |

RLS: `select` for `anon` where `status = 'published'`; writes for
`service_role` only.

### admin_profiles

Who can access `/admin`.

| Column | Type |
| --- | --- |
| id | uuid pk (mirrors auth.users.id) |
| email | text not null |
| role | text not null default 'editor' check in (editor, admin) |
| created_at | timestamptz default now() |

RLS: a user can `select` their own row; `service_role` manages the table.
Admin auth checks membership here — absence means no admin access.

## Migration approach

Migrations live in `supabase/migrations/NNNN_name.sql`, applied with
`supabase db push` or the Supabase dashboard. Every migration:

1. Uses `IF NOT EXISTS` / `IF NOT FOUND` guards.
2. Enables RLS before creating policies.
3. Never drops columns, tables, or data.
