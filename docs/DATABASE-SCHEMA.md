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
| currency | text not null default 'USD' check in (USD, EUR, GBP) | |
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
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | |

RLS: `select` allowed for `anon` **only** where `approval_status = 'approved'`.
Write access (`insert/update/delete`) only for `service_role`.

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
