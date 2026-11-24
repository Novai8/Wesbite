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

RLS is enabled with `products_read_approved` (approved rows only). Public access
is limited to **column-level** `SELECT` on exactly the columns the
`catalogue_products` view projects:

- `revoke all on public.affiliate_products from public, anon, authenticated`
- `grant select (<the view's columns>) on public.affiliate_products to anon, authenticated`
- table-level `SELECT` stays revoked, so `select *` is denied
- research columns, `model_error` and `commission_info` are never granted
- `insert`/`update`/`delete` remain `service_role` only

#### catalogue_products (view)

Customer-facing projection of approved rows. A `security_barrier` view owned by
`postgres`, readable by `anon` and `authenticated`, and running as the
caller (`security_invoker = true`). Two separate narrowing mechanisms are at
work, and they are not interchangeable: RLS is **row-level** and decides which
rows an approved reader may see, while the view's **column projection** decides
which columns exist at all. RLS can never hide a column, and a projection can
never hide a row.

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

#### Why the view is `security_invoker = true`

The Supabase security advisor flags `security_definer_view` (lint 0010). That
warning was previously suppressed here on the theory that the view was a safe
boundary because `anon` holds no privilege on the base table. **That reasoning
was wrong, and it is what allowed the incident.**

The view is a simple single-table view, so PostgreSQL treats it as
**auto-updatable**: `INSERT`/`UPDATE`/`DELETE` written against the view are
rewritten onto `public.affiliate_products`. A view without `security_invoker`
runs as its owner, and *a table's owner is exempt from that table's own RLS
policies*. Revoking on the base table never helped, because the caller never
touches the base table -- the view owner does, as the owner.

Measured on PostgreSQL 18 with a plain `NOSUPERUSER NOBYPASSRLS` owner that owns
the base table: `delete from <view>` removed a row (`DELETE 1`) while the same
statement against the table directly was refused with `permission denied`. The
exemption is **table ownership**, not superuser status, which is why
`security_definer_view` alone is the defect.

`20261124130000_fyndra_public_acl_lockdown.sql` sets `security_invoker = true`,
so every statement through the view is privilege-checked and RLS-filtered as the
caller. `security_barrier = true` is kept for predicate-leak protection on
reads; it never affected writability.

#### Required base-table column privileges

`security_invoker` means the caller must hold `SELECT` on each column the view
references. Those grants are **required**, not optional, and are derived from
the view's own projection so they cannot drift from it:

```sql
select string_agg(quote_ident(v.attname), ', ' order by v.attnum)
  from pg_attribute v
 where v.attrelid = 'public.catalogue_products'::regclass
   ...
grant select (<derived list>) on public.affiliate_products to anon, authenticated;
```

Verified properties of that grant:

- Removing one granted column breaks the public read with
  `42501 permission denied for table affiliate_products`, which proves the
  grants are load-bearing rather than belt-and-braces.
- Column grants widen **columns, never rows**. RLS still applies: as `anon` the
  base table returns 1 approved row and 0 unapproved rows.
- Research columns (`evidence_notes`, `score`, `research_confidence`,
  `decision`), operator-facing `model_error` and `commission_info` (signed feed
  provenance) are absent from the view, so they are never granted and remain
  unreachable even by direct query.

#### Access control: public roles are SELECT-only, and future objects are closed

The overview above explains *why* the view was exploitable. This section records
the **grant** state that made it reachable over PostgREST.

Supabase's default privileges in `public` **were**
`grant all on tables to anon, authenticated, service_role`, and those defaults
applied to views as well as tables. The 3D migration added
`grant select on public.catalogue_products to anon, authenticated` but never
revoked the inherited grant, so the effective ACL stayed
`anon=arwdDxtm/postgres`. `GRANT` is additive; it cannot narrow an existing
grant. The result **was** a live anonymous write path over PostgREST:

```sql
begin;
set local role anon;
delete from public.catalogue_products where true;
commit;
```

That statement removed every approved product row (confirmed against disposable
local PostgreSQL 17 and 18).

`20261124130000_fyndra_public_acl_lockdown.sql` closes it with two independent
defences, neither of which is a grant:

1. **The view runs as the caller.** It becomes `security_invoker = true`, so
   every statement through it is privilege-checked and RLS-filtered as the
   caller. The rewrite-as-owner path is gone, which means a future re-grant
   cannot resurrect the `DELETE`. `security_barrier = true` is retained; it
   guards predicate leakage on reads and is unrelated to writability.
2. **The grant layer is fail-closed.** `anon` and `authenticated` get
   `SELECT` on the view and the minimal column-level `SELECT` on the base
   table that the view projects -- nothing else anywhere in `public`.

**Column-level grants.** `security_invoker` checks the caller's privileges
against the base table's *columns*, so the base table needs per-column
`SELECT`. The grant is derived from the view's own column list rather than
hand-maintained, so the two cannot drift. Table-level `SELECT` stays revoked.
The research columns (`evidence_notes`, `score`, `research_confidence`,
`decision`), `model_error` and `commission_info` (signed advertiser feed
URLs) are absent from the view, so they are never granted and remain
unreachable even by direct query.

**RLS is kept, and now actually applies.** Because reads run as the caller,
`products_read_approved` is evaluated for real instead of being bypassed by
table ownership. It is asserted by the migration, never redefined, so the
policy stays owned by `0001_admitad_integration.sql`. RLS remains defence in
depth: it is row-level, it runs only after the table privilege check passes, and
it cannot restrict `TRUNCATE` at all.

**Internal relations are closed outright.** `affiliate_programs`,
`affiliate_categories`, `admitad_import_runs`, `admitad_import_errors`,
`affiliate_clicks` and `product_model_jobs` lose every privilege for both
public roles, in addition to `affiliate_products`. Programme and category
content is served from seed data (`getPrograms()`/`getCategories()` in
`src/lib/catalogue.ts` never touch Supabase), so granting them publicly would
be access with no consumer. The relation list is explicit and guarded with
`to_regclass`; relations outside it are reported as `UNREVIEWED` in the
migration log rather than revoked silently, so a grant added later by a
different, reviewed migration is not clobbered by a re-run.

**TRUNCATE, REFERENCES, TRIGGER and MAINTAIN.** `TRUNCATE` bypasses RLS
entirely, so where it is granted it is strictly worse than `DELETE`.
`MAINTAIN` (PostgreSQL 17+, a syntax error on 16) permits `VACUUM`,
`ANALYZE`, `CLUSTER`, `REINDEX` and `LOCK TABLE`; a role holding it could
take `ACCESS EXCLUSIVE` on `affiliate_products` and block every catalogue
reader. Both are revoked, and every `MAINTAIN` statement is gated on
`server_version_num >= 170000`. `REFERENCES` and `TRIGGER` are
schema-owner concerns with no public client use. Sequences are revoked
schema-wide, because a future `bigserial` column would otherwise hand a public
role a usable `nextval`.

`service_role` is deliberately untouched: imports, the 3D worker and click
logging all run as `service_role`, and its access on both the view and the
base table is asserted by the migration's own self-check.

#### Future objects are born closed

PostgreSQL's built-in behaviour is already fail-closed: a new table grants
nothing to `PUBLIC` or to `anon`/`authenticated`. The exposure comes only from
per-role entries in `pg_default_acl`, so the migration **deletes** those entries
rather than narrowing them to `SELECT`. A default `SELECT` is an un-reviewed
grant to whatever table a future migration happens to create, which is not a
safe resting state.

Two measured constraints shape the implementation:

- Global and schema-scoped default-ACL entries are **unioned**. A schema-scoped
  `revoke all` does not cancel a global `grant all`; it silently does
  nothing. Both scopes are revoked. (Verified on PG 18: global `GRANT ALL` plus
  schema `REVOKE ALL` still left a new table fully writable.)
- `alter default privileges for role x` requires membership in `x` (or
  superuser), otherwise `42501`.

**Enforcement scope is explicit.** `postgres` -- the actual Fyndra migration
role -- is a hard requirement: if its defaults cannot be changed the migration
**raises**, because no hardening was achieved. Every other creator role is
best-effort: attempted, recorded if it fails with `42501`, and never assumed
changeable. The self-check asserts only over the roles the migration actually
managed. There is no event trigger and no superuser requirement.

#### Limitation: `supabase_admin`-owned objects

Objects created by the reserved role `supabase_admin` may still be born with
permissive grants. **A PostgreSQL migration run as `postgres` cannot modify
`supabase_admin`'s default privileges or its objects' ACLs** -- the server
refuses with `42501 permission denied to change default privileges`. This
migration does not claim otherwise; it records those roles and warns.

Closing the gap requires a platform-level action, not an application migration:

- Supabase runs the equivalent `alter default privileges for role supabase_admin
  revoke all on tables from public, anon, authenticated` (and the schema-scoped
  form), or
- the migration role is granted membership in `supabase_admin`.

Until then, every relation created by that role needs its ACL re-checked by
whoever reviews that migration: `MAINTAIN`, `TRUNCATE` and write grants on
`supabase_admin`-owned objects are **not** covered by this migration, even
though `postgres`-owned objects are.

The asymmetry is deliberate and should not be read as an oversight:

| Object creator | Default privileges after this migration | Guarantee |
| --- | --- | --- |
| `postgres` (actual Fyndra migration role) | revoked at global and `public` scope, tables and sequences | **guaranteed**; a failure raises and aborts the migration |
| other resolvable creator roles | attempted, then recorded if the server refuses | best-effort; never assumed |
| `supabase_admin` (reserved platform role) | unchanged by this migration | **not** covered; needs platform action |

An object can therefore be closed because `postgres` created it and still be
born permissive if `supabase_admin` did.

#### Extension-owned objects in `public`

An extension installed into `public` (rather than the dedicated
`extensions` schema) brings its own relations and functions, and Supabase's
default privileges may have granted the public roles access to them. The
migration **reports** such objects rather than revoking them automatically: an
extension-owned object may be a supported API surface, and revoking it blindly
would be a reliability change disguised as a hardening change.

Recommendation: install extensions into `extensions`
(`create extension ... with schema extensions`) so they sit outside the exposed
schema entirely. `alter extension ... set schema extensions` can move an existing
extension when the extension supports relocation.

#### Residual risks

- **Row-count enumeration.** Column-level grants allow `count(*)`, because it
  allocates no column privileges. RLS still limits which rows are counted
  (approved only), so the count of approved products is public. Accepted.
- **`supabase_admin`-owned objects.** See above; requires a platform fix.
- **Platform re-application.** If Supabase re-applies permissive default
  privileges to `public` in future, new objects would be born open again.
  Re-running this migration restores the closed state; re-run it after any
  platform-level schema change.
- **Third-party creator roles.** Any role other than `postgres` whose defaults
  cannot be altered is reported, not fixed.
- **`rls_auto_enable()`** remains executable by `anon`. It is a platform-managed
  helper owned by `postgres`; rewriting it from an application migration could
  disable RLS auto-enablement for future tables, so it is left alone.

Regression coverage lives in two suites. `tests/test_catalogue_acl_static.py`
parses the shipped SQL and asserts the security contracts with no server. `tests/test_catalogue_acl_lockdown.py`
runs the real migration files against disposable PostgreSQL 17 and 18, and skips
cleanly when no server is reachable. A skipped run is never evidence of database
security (see `docs/TESTING.md`). Together they cover anonymous and
authenticated roles separately, public `SELECT`, `INSERT`/`UPDATE`/`DELETE`,
direct base-table access, sensitive-column denial, `TRUNCATE`, `MAINTAIN`,
`LOCK`, `REFERENCES`, `TRIGGER`, internal tables, future tables, views and
sequences, both default-ACL scopes, fresh provisioning, upgrade-in-place and
idempotency. `VulnerableBaseline` pins the original bug so the suite cannot rot
into a no-op, and `RejectedCompetingMigration` proves the rejected design fails
the same assertions.

#### Function `search_path` pinning

`public.protect_manual_product()` and
`public.set_product_model_jobs_updated_at()` are trigger functions whose
bodies call `now()`. PostgreSQL resolves unqualified names against the
**caller's** `search_path` unless the function pins one, so a role able to
create objects in an earlier schema could shadow what the body calls
(`function_search_path_mutable`, lint 0011).

`20261124090000_fyndra_function_search_path.sql` re-creates both functions with
`set search_path` to an empty path and schema-qualifies the calls (`pg_catalog.now()`).
Behaviour and triggers are unchanged; only name resolution is pinned. The
migration is additive and self-checking: it raises if a function exists but
did not receive the pin. All advisory warnings for these two functions
disappear.

#### `rls_auto_enable()` — platform-managed, deliberately untouched

The advisor also flags `public.rls_auto_enable()`. It is **not** project code:
Supabase ships it as an event-trigger function (registered on the
`ensure_rls` event trigger) that enables RLS on newly created tables. Its
body contains no application SQL, and it is not callable as an ordinary
function (`0A000 trigger functions can only be called as triggers`), including
through PostgREST. No application migration rewrites it — redefining a
platform helper from our side could silently disable RLS auto-enablement for
future tables.

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
