# Database Schema

Fyndra uses Supabase (PostgreSQL) for persistent storage. The seed catalogue
in `src/data/seed-products.ts` mirrors these tables so the app runs fully
without credentials — the Supabase layer swaps in when configured.

The earliest migration (`supabase/migrations/0001_admitad_integration.sql`)
creates these tables if the database has never had them, then adds the Admitad
columns described below. It is idempotent and purely additive.

> **This migration has not been applied to the live Supabase project.** It was
> verified by executing it against a disposable PostgreSQL cluster seeded with
> the exact live `affiliate_products` schema. See
> [Applying the migration](#applying-the-migration).

## Rules

1. **Never reset or drop existing tables.** All migrations are additive
   (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN IF NOT EXISTS`).
2. The service-role key lives server-side only and is never referenced by
   any client code path. Browser code can only touch tables through RLS-
   governed anon access or via server API routes.
3. Row Level Security is enabled on every table. No table is left public.

## Tables

### affiliate_products

One table, two pipelines. The **Affiliate Business** project uses
`affiliate_products` for affiliate *research*; the Fyndra importer writes a
*catalogue* into the same table. The migration lets both coexist:

| Field group | Written by | Never written by |
| --- | --- | --- |
| Research (20 columns below) | the research workflow | the Admitad importer |
| Catalogue (columns below) | the Admitad importer | the research workflow |

`status` (research lifecycle) and `approval_status` (catalogue visibility) are
**separate columns with different meanings**. Nothing maps one onto the other.

#### Live research columns (inspected 2026-11-23, preserved unchanged)

| Column | Type |
| --- | --- |
| id | **uuid primary key**, default `gen_random_uuid()` |
| created_at | timestamptz default now() |
| product_name | text |
| product_url | text |
| affiliate_url | text (shared with the catalogue) |
| affiliate_network | text |
| category | text |
| target_market | text |
| price_text | text |
| commission_rate_text | text |
| evidence_notes | text |
| decision | text |
| score | integer |
| target_audience | text |
| positioning_angle | text |
| content_hooks | text |
| risk_flags | text |
| research_confidence | numeric |
| rationale | text |
| status | text |

The migration never adds a constraint, default or rewrite to these columns.
Existing rows keep `data_source = NULL` and `approval_status = NULL`, so they
stay out of the public catalogue read without being modified.

#### Catalogue columns

All are nullable, so a research insert never has to supply them.

| Column | Type | Notes |
| --- | --- | --- |
| slug | text | unique index; NULL for research rows |
| title | text | |
| description | text | |
| category_slug | text | app-validated against `affiliate_categories.slug` |
| subcategory | text | |
| image_urls | jsonb default '[]' | array of URLs |
| merchant | text | |
| program_slug | text | app-validated against `affiliate_programs.slug` |
| affiliate_url | text | shared column; validated against programme domain |
| source_url | text | public listing the data came from |
| price | numeric(12,2) | widened only if already numeric |
| currency | text | ISO 4217 shaped (`^[A-Z]{3}$`), see note below |
| previous_price | numeric(12,2) | for was/now display |
| original_price | numeric(12,2) | pre-discount price, when supplied |
| specs | jsonb default '{}' | key/value spec pairs |
| pros | jsonb default '[]' | |
| cons | jsonb default '[]' | |
| availability | text | `in_stock` / `out_of_stock` / `unknown`, app-validated |
| region | jsonb default '[]' | ISO country codes |
| keywords | jsonb default '[]' | matching tokens for the engine |
| use_cases | jsonb default '[]' | problems this solves |
| budget_tier | text | `budget` / `mid` / `premium`, app-derived |
| price_verified_at | timestamptz | last price check |
| approval_status | text default 'pending' | catalogue visibility |
| data_source | text default 'manual' | `manual`, `api`, `csv_import`, `n8n_workflow` |
| source | text | `admitad`, `aliexpress`, `manual` |
| external_product_id | text | Admitad feed product id |
| advertiser_id | text | Admitad programme id |
| commission_info | jsonb | structured provenance, **never an estimate** |
| last_synced_at | timestamptz | last successful import |
| ai_headline | text | AI copy; never a source of facts |
| ai_description | text | AI copy |
| ai_quality_flags | jsonb default '[]' | deterministic completeness flags |
| updated_at | timestamptz default now() | |

Defaults are attached with `ALTER COLUMN … SET DEFAULT` rather than
`ADD COLUMN … DEFAULT`. Since PostgreSQL 11 the latter rewrites every existing
row, which would have written catalogue defaults into research rows.

Dedupe constraint (exact `on_conflict` target):

```sql
create unique index affiliate_products_source_advertiser_external_key
  on affiliate_products (source, advertiser_id, external_product_id);
```

The index is intentionally **not** partial: PostgREST's `on_conflict` can only
target a non-partial unique index, and a partial one makes every upsert fail
with `no unique or exclusion constraint matching the ON CONFLICT specification`.
PostgreSQL treats NULLs as distinct in a unique index, so manual rows — which
have no source or external id — are unaffected.

Advertiser ids are part of the key because feed product ids are only guaranteed
unique inside one advertiser's feed; two programmes may legitimately publish the
same external id.

`protect_manual_product` (a before-update trigger) refuses to let an automated
upsert claim a manual row. A row is manual when `data_source = 'manual'` **or
`data_source IS NULL`** — the second branch is what protects the existing
research rows, which have no `data_source` value. A manual row also never has
its `source` / `external_product_id` / `advertiser_id` rewritten.

`id` stays `uuid` on the live project. Imported records use a deterministic,
RFC 4122 version-5 UUID derived from `(source, advertiser_id,
external_product_id)`, which is already UUID-shaped and stable across re-syncs.
The migration also gives `id` a `gen_random_uuid()` default if it is `uuid`, and
a UUID-shaped text default only if a database still uses the old `id text`
shape. No column type is ever changed.

`created_at` is never sent by an import upsert; the column keeps its
`default now()` on insert and is not rewritten on re-sync.

The currency check is added as `NOT VALID`. PostgreSQL still validates new and
updated rows, but a legacy row whose currency predates the rule is never
rejected or rewritten by the migration. Re-validate later with
`ALTER TABLE ... VALIDATE CONSTRAINT` once existing data is reviewed.

The cleanup that removes an old three-currency allowlist only drops a constraint
whose definition is a *single-column* currency comparison. A combined rule such
as `CHECK (currency = 'USD' AND price >= 0)` is left untouched.

RLS: `select` allowed for `anon`/`authenticated` **only** where
`approval_status = 'approved'`. Write access (`insert/update/delete`) only for
`service_role`.

Research rows therefore never appear in the public catalogue: their
`approval_status` is NULL. That is why the importer-owned rows must be approved
explicitly.

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

### admitad_import_runs

One row per import execution: `campaign_id`, `programme_name`, `feed_format`,
`total_rows`, `imported`, `duplicates`, `skipped`, `error_count`, `blocked`,
`blocked_reason`, `unmapped_columns`, `started_at`, `finished_at`.

RLS: `service_role` only.

### admitad_import_errors

Per-row failures, cascading from a run: `run_id`, `row_index`,
`external_product_id`, `reason`. Capped at 200 rows per run.

RLS: `service_role` only.

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
| product_id | text | seed ids are strings (`p-monitor-arm-gas`); imported ids are UUID strings |
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

### Applying the migration

`0001_admitad_integration.sql` has **not** been applied to the live project and
nothing in this branch was deployed. To apply it after review:

1. **Snapshot first.** In the Supabase dashboard, take a backup or record
   `select * from public.affiliate_products` (currently zero rows) plus
   `\d public.affiliate_products`.
2. **Dry run on a copy.** Apply the file to a scratch project seeded with the
   live schema — not to production — and confirm:
   ```sql
   select column_name, data_type, is_nullable
   from information_schema.columns
   where table_schema = 'public' and table_name = 'affiliate_products'
   order by ordinal_position;
   ```
3. **Apply.** Run the file in the SQL editor or via `supabase db push`. The whole
   file is one transaction-safe sequence of additive statements.
4. **Post-verify.**
   ```sql
   -- 53 total: 20 research columns + 33 catalogue columns
   select count(*) from information_schema.columns
   where table_schema='public' and table_name='affiliate_products';

   -- dedupe index is unique and non-partial
   select indexdef from pg_indexes
   where tablename='affiliate_products'
     and indexname='affiliate_products_source_advertiser_external_key';

   -- currency rule is NOT VALID (legacy rows untouched)
   select conname, convalidated from pg_constraint
   where conrelid='public.affiliate_products'::regclass
     and conname='affiliate_products_currency_iso';

   -- RLS + policies
   select relrowsecurity from pg_class
   where oid='public.affiliate_products'::regclass;
   select policyname, roles from pg_policies
   where tablename='affiliate_products';
   ```
5. **Re-run the file** once to prove idempotency, then verify the research
   columns and any research rows are unchanged.
